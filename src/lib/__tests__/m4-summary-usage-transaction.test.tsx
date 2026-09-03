/**
 * @vitest-environment jsdom
 *
 * M4 Summary Generate usage accounting uses the production ledger and store,
 * not an optimistic page counter or a mocked increment function.
 */
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_USAGE_SCHEMA_VERSION,
  AI_USAGE_STORAGE_KEY,
  PRO_AI_SAFETY_CAP,
  commitProAiUserAction,
  type ProAiRecord,
} from '../ai-usage-policy';
import { AppProvider, useApp } from '../store';

const iap = vi.hoisted(() => ({
  initIAP: vi.fn(),
  syncProEntitlement: vi.fn(),
}));

vi.mock('../iap', () => ({
  initIAP: iap.initIAP,
  syncProEntitlement: iap.syncProEntitlement,
}));

type AppState = ReturnType<typeof useApp>;
let app: AppState | null = null;

function Probe() {
  app = useApp();
  return <output data-testid="usage-count">{app.getProAiUsageCount()}</output>;
}

function seedUsage(count: number, windowStart = Date.now()): void {
  const record: ProAiRecord = {
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart,
    policyLimit: 50,
  };
  localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify(record));
}

function renderStore(): AppState {
  app = null;
  render(<AppProvider><Probe /></AppProvider>);
  if (!app) throw new Error('AppProvider did not render the usage probe');
  return app;
}

describe('M4 authoritative usage transaction', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    iap.initIAP.mockResolvedValue(undefined);
    iap.syncProEntitlement.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('commits the canonical ledger 0 → 1 once and synchronizes the React store from that receipt', async () => {
    seedUsage(0);
    renderStore();
    await act(async () => { app?.setIsPro(true, 'usage-test-token'); });
    await waitFor(() => expect(app?.getAiGate().status).toBe('ready'));

    const priorGetter = app?.getProAiUsageCount;
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    let result: ReturnType<AppState['commitProAiSuccess']> | null = null;
    await act(async () => { result = app?.commitProAiSuccess() ?? null; });

    expect(result).toMatchObject({
      ok: true, attempted: true, forwardWriteResult: 'succeeded', verificationResult: 'passed',
      rollbackAttempted: false, rollbackResult: 'not_required', before: 0, after: 1, delta: 1,
    });
    expect(JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 1 });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(1);
    await waitFor(() => expect(app?.getProAiUsageCount).not.toBe(priorGetter));
    expect(app?.getProAiUsageCount()).toBe(1);
  });

  it('fails typed when the gate became unavailable and performs no ledger write', async () => {
    seedUsage(0);
    renderStore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    let result: ReturnType<AppState['commitProAiSuccess']> | null = null;
    await act(async () => { result = app?.commitProAiSuccess() ?? null; });

    expect(result).toMatchObject({
      ok: false, attempted: false, forwardWriteResult: 'not_attempted', rollbackResult: 'not_required',
      before: 0, after: 0, delta: 0, reason: 'ai_gate_not_ready',
    });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 0 });
  });

  it('uses the current canonical ledger rather than a stale request-start count', () => {
    const now = Date.now();
    seedUsage(5, now);
    // A separate legitimate action completed while the M4 request was in flight.
    seedUsage(6, now);
    const result = commitProAiUserAction({ aiGateReady: true, now });

    expect(result).toMatchObject({ ok: true, before: 6, after: 7, delta: 1 });
    expect(JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 7 });
  });

  it('keeps the legacy recordProAiSuccess API void-facing while using the same policy owner', async () => {
    seedUsage(0);
    renderStore();
    await act(async () => { app?.setIsPro(true, 'usage-test-token'); });
    await waitFor(() => expect(app?.getAiGate().status).toBe('ready'));

    let legacyResult: ReturnType<AppState['recordProAiSuccess']> = undefined;
    await act(async () => { legacyResult = app?.recordProAiSuccess(); });

    expect(legacyResult).toBeUndefined();
    expect(app?.getProAiUsageCount()).toBe(1);
  });

  it('reports a persistence failure without a false success or changed ledger', () => {
    seedUsage(0);
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === AI_USAGE_STORAGE_KEY) throw new Error('storage unavailable');
      return originalSetItem.call(this, key, value);
    });

    const result = commitProAiUserAction({ aiGateReady: true });

    expect(result).toMatchObject({
      ok: false, attempted: true, forwardWriteResult: 'failed', verificationResult: 'failed',
      rollbackAttempted: false, rollbackResult: 'not_required', before: 0, after: 0, delta: 0,
      reason: 'usage_persist_failed',
    });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 0 });
  });

  it('rejects a reached cap before any forward usage write', () => {
    seedUsage(PRO_AI_SAFETY_CAP);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    const result = commitProAiUserAction({ aiGateReady: true });

    expect(result).toMatchObject({
      ok: false, attempted: false, forwardWriteResult: 'not_attempted', verificationResult: 'not_attempted',
      rollbackAttempted: false, rollbackResult: 'not_required', before: PRO_AI_SAFETY_CAP,
      after: PRO_AI_SAFETY_CAP, delta: 0, reason: 'usage_cap_reached',
    });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(0);
  });

  it('restores the exact prior ledger when the verification read fails after a forward write', () => {
    seedUsage(0);
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    let usageReads = 0;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === AI_USAGE_STORAGE_KEY && ++usageReads === 2) throw new Error('verification unavailable');
      return originalGetItem.call(this, key);
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      return originalSetItem.call(this, key, value);
    });

    const result = commitProAiUserAction({ aiGateReady: true });

    expect(result).toMatchObject({
      ok: false, attempted: true, forwardWriteResult: 'succeeded', verificationResult: 'unknown',
      rollbackAttempted: true, rollbackResult: 'succeeded', before: 0, after: 0, delta: 0,
      reason: 'usage_verification_failed',
    });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(2);
    expect(getItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 0 });
  });

  it('restores the exact prior ledger after an unexpected verified post-write count', () => {
    seedUsage(0);
    const originalSetItem = Storage.prototype.setItem;
    let usageWrites = 0;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === AI_USAGE_STORAGE_KEY && ++usageWrites === 1) {
        const altered = { ...JSON.parse(value), count: 9 };
        return originalSetItem.call(this, key, JSON.stringify(altered));
      }
      return originalSetItem.call(this, key, value);
    });

    const result = commitProAiUserAction({ aiGateReady: true });

    expect(result).toMatchObject({
      ok: false, attempted: true, forwardWriteResult: 'succeeded', verificationResult: 'failed',
      rollbackAttempted: true, rollbackResult: 'succeeded', before: 0, after: 0, delta: 0,
      reason: 'usage_verification_failed',
    });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 0 });
  });

  it('does not claim an unchanged ledger when the compensating usage rollback write fails', () => {
    seedUsage(0);
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    let usageReads = 0;
    let usageWrites = 0;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === AI_USAGE_STORAGE_KEY && ++usageReads === 2) throw new Error('verification unavailable');
      return originalGetItem.call(this, key);
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === AI_USAGE_STORAGE_KEY && ++usageWrites === 2) throw new Error('rollback unavailable');
      return originalSetItem.call(this, key, value);
    });

    const result = commitProAiUserAction({ aiGateReady: true });

    expect(result).toMatchObject({
      ok: false, attempted: true, forwardWriteResult: 'succeeded', verificationResult: 'unknown',
      rollbackAttempted: true, rollbackResult: 'failed', before: 0, after: 1, delta: 1,
      reason: 'usage_rollback_failed',
    });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 1 });
  });

  it('reports an explicit unknown final usage state when rollback cannot be read back', () => {
    seedUsage(0);
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    let usageReads = 0;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      return originalSetItem.call(this, key, value);
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === AI_USAGE_STORAGE_KEY && ++usageReads >= 2) throw new Error('readback unavailable');
      return originalGetItem.call(this, key);
    });

    const result = commitProAiUserAction({ aiGateReady: true });

    expect(result).toMatchObject({
      ok: false, attempted: true, forwardWriteResult: 'succeeded', verificationResult: 'unknown',
      rollbackAttempted: true, rollbackResult: 'unknown', before: 0, after: null, delta: null,
      reason: 'usage_final_state_unknown',
    });
    expect(setItem.mock.calls.filter(([key]) => key === AI_USAGE_STORAGE_KEY)).toHaveLength(2);
    expect(JSON.parse(originalGetItem.call(localStorage, AI_USAGE_STORAGE_KEY) || '{}')).toMatchObject({ count: 0 });
  });
});
