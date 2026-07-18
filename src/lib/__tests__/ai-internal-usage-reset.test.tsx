/**
 * @vitest-environment jsdom
 *
 * Internal-only AI usage ledger reset — compile-time gate, UI, storage safety.
 *
 * Gate tests reload modules after setting NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED
 * so they mirror Next's client inlining (literal env access), not dynamic keys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  AI_USAGE_SCHEMA_VERSION,
  AI_USAGE_STORAGE_KEY,
  PRO_AI_SAFETY_CAP,
  PRO_AI_WINDOW_MS,
  canUseProAiSafety,
  getProAiUsageCount,
  getProAiUsageDiagnosticsSnapshot,
  loadProAiRecord,
  recordProAiUserActionSuccess,
} from '@/lib/ai-usage-policy';
import { computeInternalAiResetEnabledFromSourceFlags } from '@/lib/build-channel';
import { CV_DRAFT_STORAGE_KEY, CL_DRAFT_STORAGE_KEY } from '@/lib/draft-storage';

function setCompiledGate(value: 'true' | 'false' | undefined) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED;
  else process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED = value;
}

async function loadGateModules() {
  vi.resetModules();
  const buildChannel = await import('@/lib/build-channel');
  const policy = await import('@/lib/ai-usage-policy');
  const ui = await import('@/components/CvExportDiagnosticsControls');
  return { ...buildChannel, ...policy, ...ui };
}

function seedCapReached(now = Date.now()) {
  localStorage.setItem(
    AI_USAGE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: AI_USAGE_SCHEMA_VERSION,
      count: PRO_AI_SAFETY_CAP,
      windowStart: now,
      policyLimit: PRO_AI_SAFETY_CAP,
    }),
  );
}

const CV_FIXTURE = JSON.stringify({
  cv: { personal: { fullName: 'Test Fixture' }, experience: [] },
  savedAt: '2026-07-18T00:00:00.000Z',
});
const CL_FIXTURE = JSON.stringify({
  coverLetter: { content: 'Hello' },
  savedAt: '2026-07-18T00:00:00.000Z',
});

describe('source-flag policy (next.config input)', () => {
  it('requires both flags exactly', () => {
    expect(computeInternalAiResetEnabledFromSourceFlags('internal', 'true')).toBe(true);
  });

  it('one flag only / absent / wrong casing → disabled', () => {
    expect(computeInternalAiResetEnabledFromSourceFlags('internal', undefined)).toBe(false);
    expect(computeInternalAiResetEnabledFromSourceFlags(undefined, 'true')).toBe(false);
    expect(computeInternalAiResetEnabledFromSourceFlags('internal', 'false')).toBe(false);
    expect(computeInternalAiResetEnabledFromSourceFlags('production', 'true')).toBe(false);
    expect(computeInternalAiResetEnabledFromSourceFlags(undefined, undefined)).toBe(false);
    expect(computeInternalAiResetEnabledFromSourceFlags('Internal', 'true')).toBe(false);
    expect(computeInternalAiResetEnabledFromSourceFlags('internal', 'True')).toBe(false);
  });
});

describe('compile-time INTERNAL_AI_RESET_ENABLED (client-like reload)', () => {
  const prev = process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED;

  afterEach(() => {
    setCompiledGate(prev as 'true' | 'false' | undefined);
    vi.resetModules();
  });

  it('literal true → helper true', async () => {
    setCompiledGate('true');
    const mod = await loadGateModules();
    expect(mod.INTERNAL_AI_RESET_ENABLED).toBe(true);
    expect(mod.isInternalAiResetEnabled()).toBe(true);
  });

  it('literal false / absent → helper false', async () => {
    setCompiledGate('false');
    let mod = await loadGateModules();
    expect(mod.INTERNAL_AI_RESET_ENABLED).toBe(false);
    expect(mod.isInternalAiResetEnabled()).toBe(false);

    setCompiledGate(undefined);
    mod = await loadGateModules();
    expect(mod.INTERNAL_AI_RESET_ENABLED).toBe(false);
  });
});

describe('internal AI reset when compiled enabled', () => {
  const prev = process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED;

  beforeEach(() => {
    setCompiledGate('true');
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, CV_FIXTURE);
    localStorage.setItem(CL_DRAFT_STORAGE_KEY, CL_FIXTURE);
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', 'test-token');
    localStorage.setItem('cvpro-downloads', JSON.stringify({ cv: 1, cl: 0 }));
    localStorage.setItem('unrelated-key', 'keep-me');
  });

  afterEach(() => {
    cleanup();
    setCompiledGate(prev as 'true' | 'false' | undefined);
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reset UI exists with labels; confirmation; ledger cleared; CV/Pro survive', async () => {
    seedCapReached();
    const mod = await loadGateModules();
    expect(mod.getProAiUsageCount()).toBe(50);
    expect(mod.canUseProAiSafety(true)).toBe(false);

    render(<mod.CvExportDiagnosticsModal open onClose={() => {}} />);
    expect(await screen.findByTestId('internal-ai-usage-reset-panel')).toBeTruthy();
    expect(screen.getByText('Build channel: internal')).toBeTruthy();
    expect(screen.getByText('AI test reset: enabled')).toBeTruthy();
    expect(screen.getByText(/count:\s*50/)).toBeTruthy();
    expect(screen.getByTestId('internal-ai-usage-reset-button')).toBeTruthy();

    fireEvent.click(screen.getByTestId('internal-ai-usage-reset-button'));
    fireEvent.click(screen.getByTestId('internal-ai-usage-reset-confirm'));

    expect(mod.getProAiUsageCount()).toBe(0);
    expect(mod.canUseProAiSafety(true)).toBe(true);
    expect(localStorage.getItem(CV_DRAFT_STORAGE_KEY)).toBe(CV_FIXTURE);
    expect(localStorage.getItem(CL_DRAFT_STORAGE_KEY)).toBe(CL_FIXTURE);
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(localStorage.getItem('cvpro-pro-token')).toBe('test-token');
    expect(localStorage.getItem('cvpro-downloads')).toBe(JSON.stringify({ cv: 1, cl: 0 }));
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('50 → reset 0 → next success 1; reset itself +0', async () => {
    seedCapReached();
    const mod = await loadGateModules();
    expect(mod.resetProAiTestUsageLedger().ok).toBe(true);
    expect(mod.getProAiUsageCount()).toBe(0);
    mod.recordProAiUserActionSuccess();
    expect(mod.getProAiUsageCount()).toBe(1);
  });

  it('window expiry is windowStart + 30 days', async () => {
    const now = Date.now();
    seedCapReached(now);
    await loadGateModules();
    const snap = getProAiUsageDiagnosticsSnapshot(now);
    expect(new Date(snap.windowExpiresIso!).getTime()).toBe(now + PRO_AI_WINDOW_MS);
  });
});

describe('internal AI reset when compiled disabled', () => {
  const prev = process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED;

  beforeEach(() => {
    setCompiledGate('false');
    localStorage.clear();
    seedCapReached();
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, CV_FIXTURE);
  });

  afterEach(() => {
    cleanup();
    setCompiledGate(prev as 'true' | 'false' | undefined);
    vi.resetModules();
    localStorage.clear();
  });

  it('reset UI absent; reset refused; ledger untouched', async () => {
    const mod = await loadGateModules();
    render(<mod.CvExportDiagnosticsModal open onClose={() => {}} />);
    expect(screen.queryByTestId('internal-ai-usage-reset-panel')).toBeNull();
    expect(screen.queryByText('Build channel: internal')).toBeNull();
    expect(screen.queryByText(/Reset AI test usage/i)).toBeNull();

    const result = mod.resetProAiTestUsageLedger();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(mod.getProAiUsageCount()).toBe(50);
    expect(localStorage.getItem(CV_DRAFT_STORAGE_KEY)).toBe(CV_FIXTURE);
  });
});

describe('counting invariants (gate-independent)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('success +1; no silent increments on idle', () => {
    localStorage.setItem(
      AI_USAGE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: AI_USAGE_SCHEMA_VERSION,
        count: 3,
        windowStart: Date.now(),
        policyLimit: PRO_AI_SAFETY_CAP,
      }),
    );
    expect(getProAiUsageCount()).toBe(3);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(4);
    expect(canUseProAiSafety(true, loadProAiRecord())).toBe(true);
  });
});
