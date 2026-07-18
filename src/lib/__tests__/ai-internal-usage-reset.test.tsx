/**
 * @vitest-environment jsdom
 *
 * Internal-only AI usage ledger reset — gate, UI, storage safety, counting.
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
  resetProAiTestUsageLedger,
} from '@/lib/ai-usage-policy';
import { isInternalAiResetEnabled } from '@/lib/build-channel';
import { CvExportDiagnosticsModal } from '@/components/CvExportDiagnosticsControls';
import { CV_DRAFT_STORAGE_KEY, CL_DRAFT_STORAGE_KEY } from '@/lib/draft-storage';

function setGate(channel: string | undefined, flag: string | undefined) {
  if (channel === undefined) delete process.env.NEXT_PUBLIC_BUILD_CHANNEL;
  else process.env.NEXT_PUBLIC_BUILD_CHANNEL = channel;
  if (flag === undefined) delete process.env.NEXT_PUBLIC_ENABLE_AI_TEST_RESET;
  else process.env.NEXT_PUBLIC_ENABLE_AI_TEST_RESET = flag;
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

describe('build-channel gate (F)', () => {
  const prevChannel = process.env.NEXT_PUBLIC_BUILD_CHANNEL;
  const prevFlag = process.env.NEXT_PUBLIC_ENABLE_AI_TEST_RESET;

  afterEach(() => {
    setGate(prevChannel, prevFlag);
  });

  it('requires both flags exactly', () => {
    setGate('internal', 'true');
    expect(isInternalAiResetEnabled()).toBe(true);
  });

  it('one flag only → disabled', () => {
    setGate('internal', undefined);
    expect(isInternalAiResetEnabled()).toBe(false);
    setGate(undefined, 'true');
    expect(isInternalAiResetEnabled()).toBe(false);
    setGate('internal', 'false');
    expect(isInternalAiResetEnabled()).toBe(false);
    setGate('production', 'true');
    expect(isInternalAiResetEnabled()).toBe(false);
  });

  it('absent flags → disabled', () => {
    setGate(undefined, undefined);
    expect(isInternalAiResetEnabled()).toBe(false);
  });

  it('unexpected casing/value → disabled', () => {
    setGate('Internal', 'true');
    expect(isInternalAiResetEnabled()).toBe(false);
    setGate('internal', 'True');
    expect(isInternalAiResetEnabled()).toBe(false);
    setGate('INTERNAL', 'TRUE');
    expect(isInternalAiResetEnabled()).toBe(false);
  });
});

describe('internal AI reset when gate enabled (A, C, D, E)', () => {
  const prevChannel = process.env.NEXT_PUBLIC_BUILD_CHANNEL;
  const prevFlag = process.env.NEXT_PUBLIC_ENABLE_AI_TEST_RESET;

  beforeEach(() => {
    setGate('internal', 'true');
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, CV_FIXTURE);
    localStorage.setItem(CL_DRAFT_STORAGE_KEY, CL_FIXTURE);
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', 'test-token');
    localStorage.setItem('cvpro-downloads', JSON.stringify({ cv: 1, cl: 0 }));
    localStorage.setItem('cvpro-cl-generations', '2');
    localStorage.setItem('unrelated-key', 'keep-me');
  });

  afterEach(() => {
    cleanup();
    setGate(prevChannel, prevFlag);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reset UI exists with count; confirmation required; ledger cleared; CV/Pro survive', () => {
    seedCapReached();
    expect(getProAiUsageCount()).toBe(50);
    expect(canUseProAiSafety(true)).toBe(false);

    render(<CvExportDiagnosticsModal open onClose={() => {}} />);
    expect(screen.getByTestId('internal-ai-usage-reset-panel')).toBeTruthy();
    expect(screen.getByText(/count:\s*50/)).toBeTruthy();
    expect(screen.getByTestId('internal-ai-usage-reset-button')).toBeTruthy();
    expect(screen.queryByTestId('internal-ai-usage-reset-confirm')).toBeNull();

    fireEvent.click(screen.getByTestId('internal-ai-usage-reset-button'));
    expect(screen.getByTestId('internal-ai-usage-reset-confirm')).toBeTruthy();
    fireEvent.click(screen.getByTestId('internal-ai-usage-reset-confirm'));

    expect(getProAiUsageCount()).toBe(0);
    expect(canUseProAiSafety(true)).toBe(true);
    expect(localStorage.getItem(CV_DRAFT_STORAGE_KEY)).toBe(CV_FIXTURE);
    expect(localStorage.getItem(CL_DRAFT_STORAGE_KEY)).toBe(CL_FIXTURE);
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(localStorage.getItem('cvpro-pro-token')).toBe('test-token');
    expect(localStorage.getItem('cvpro-downloads')).toBe(JSON.stringify({ cv: 1, cl: 0 }));
    expect(localStorage.getItem('cvpro-cl-generations')).toBe('2');
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('next successful AI apply after reset counts as 1; reset itself is +0', () => {
    seedCapReached();
    const before = getProAiUsageCount();
    expect(before).toBe(50);
    const resetResult = resetProAiTestUsageLedger();
    expect(resetResult.ok).toBe(true);
    expect(getProAiUsageCount()).toBe(0);

    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(1);
  });

  it('counting: success +1; failure/rejection paths +0; export/reset +0', () => {
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

    // Simulated provider failure / validation / stale — no increment
    expect(getProAiUsageCount()).toBe(3);

    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(4);

    const beforeExport = getProAiUsageCount();
    // export does not call recordProAiUserActionSuccess
    expect(getProAiUsageCount()).toBe(beforeExport);

    resetProAiTestUsageLedger();
    expect(getProAiUsageCount()).toBe(0);
  });

  it('50 within window blocked; reset unblocks; next valid → count 1', () => {
    const now = Date.now();
    seedCapReached(now);
    expect(canUseProAiSafety(true, loadProAiRecord(now), now)).toBe(false);
    expect(resetProAiTestUsageLedger(now).ok).toBe(true);
    expect(canUseProAiSafety(true, loadProAiRecord(now), now)).toBe(true);
    recordProAiUserActionSuccess(undefined, now);
    expect(getProAiUsageCount(now)).toBe(1);
  });

  it('diagnostics snapshot is non-PII (count/timestamps/backend only)', () => {
    seedCapReached();
    const snap = getProAiUsageDiagnosticsSnapshot();
    expect(snap.storageBackend).toBe('localStorage');
    expect(snap.storageKey).toBe(AI_USAGE_STORAGE_KEY);
    expect(snap.count).toBe(50);
    expect(snap.windowStartIso).toMatch(/^\d{4}-/);
    expect(snap.windowExpiresIso).toMatch(/^\d{4}-/);
    expect(JSON.stringify(snap)).not.toMatch(/Test Fixture|Hello|test-token/i);
  });

  it('window expiry timestamp is windowStart + 30 days', () => {
    const now = Date.now();
    seedCapReached(now);
    const snap = getProAiUsageDiagnosticsSnapshot(now);
    expect(new Date(snap.windowExpiresIso!).getTime()).toBe(now + PRO_AI_WINDOW_MS);
  });
});

describe('internal AI reset when gate disabled (B)', () => {
  const prevChannel = process.env.NEXT_PUBLIC_BUILD_CHANNEL;
  const prevFlag = process.env.NEXT_PUBLIC_ENABLE_AI_TEST_RESET;

  beforeEach(() => {
    setGate(undefined, undefined);
    localStorage.clear();
    seedCapReached();
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, CV_FIXTURE);
  });

  afterEach(() => {
    cleanup();
    setGate(prevChannel, prevFlag);
    localStorage.clear();
  });

  it('reset UI absent; reset action cannot clear ledger', () => {
    render(<CvExportDiagnosticsModal open onClose={() => {}} />);
    expect(screen.queryByTestId('internal-ai-usage-reset-panel')).toBeNull();
    expect(screen.queryByTestId('internal-ai-usage-reset-button')).toBeNull();
    expect(screen.queryByText(/Reset AI test usage/i)).toBeNull();

    const result = resetProAiTestUsageLedger();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('disabled');
    expect(getProAiUsageCount()).toBe(50);
    expect(localStorage.getItem(CV_DRAFT_STORAGE_KEY)).toBe(CV_FIXTURE);
  });

  it('no window.global reset helper is installed by the modal', () => {
    render(<CvExportDiagnosticsModal open onClose={() => {}} />);
    expect((window as unknown as { resetProAiTestUsageLedger?: unknown }).resetProAiTestUsageLedger).toBeUndefined();
    expect((window as unknown as { resetAiUsage?: unknown }).resetAiUsage).toBeUndefined();
  });
});
