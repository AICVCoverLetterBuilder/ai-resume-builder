/**
 * @vitest-environment jsdom
 *
 * Diagnostics lifecycle: clear/latest/history independence, same-window events,
 * terminal commit coverage, Copy button refresh, restart persistence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  clearSummaryAiDiagnostics,
  clearSummaryAiDiagnosticsForTests,
  getLatestSummaryAiDiagnostic,
  SummaryAiDiagnosticSession,
  SUMMARY_AI_DIAG_STORAGE_KEY,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  clearExperienceAiDiagnostics,
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
  EXPERIENCE_AI_DIAG_STORAGE_KEY,
  getLatestExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  CV_AI_DIAG_HISTORY_STORAGE_KEY,
  getCvAiDiagnosticHistory,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  CV_AI_DIAGNOSTICS_CHANGED_EVENT,
  CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER,
  emitCvAiDiagnosticsChanged,
  subscribeCvAiDiagnosticsChanged,
} from '@/lib/cv-ai-diagnostics-lifecycle';
import { AI_USAGE_STORAGE_KEY } from '@/lib/ai-usage-policy';

function snapshotDiagKeys(): Record<string, string | null> {
  return {
    [SUMMARY_AI_DIAG_STORAGE_KEY]: localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY),
    [EXPERIENCE_AI_DIAG_STORAGE_KEY]: localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY),
    [CV_AI_DIAG_HISTORY_STORAGE_KEY]: localStorage.getItem(CV_AI_DIAG_HISTORY_STORAGE_KEY),
    [AI_USAGE_STORAGE_KEY]: localStorage.getItem(AI_USAGE_STORAGE_KEY),
  };
}

function commitMinimalSummary(opts?: {
  requestId?: string;
  reason?: string | null;
  success?: boolean;
}): ReturnType<SummaryAiDiagnosticSession['commit']> {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'hi',
    requestedLocale: 'hi',
    contentLocale: 'hi',
    templateId: 'modern',
    gender: 'female',
    requestId: opts?.requestId || `sum-${Math.random().toString(36).slice(2)}`,
    usageCountBefore: 0,
    operationMode: 'enhance_existing_content',
  });
  session.recordCvSnapshot(
    {
      id: 'cv',
      name: 'CV',
      personal: {
        fullName: 'T',
        email: '',
        phone: '',
        address: '',
        jobTitle: 'Role',
        gender: 'female',
        photoEnabled: false,
      },
      summary: 'सारांश',
      contentLocale: 'hi',
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
    } as never,
    'सारांश',
  );
  session.patch({
    countedAsSuccess: Boolean(opts?.success),
    finalTypedFailureReason: opts?.reason ?? (opts?.success ? null : 'summary_noop_after_normalization'),
    meaningfulChangeDetected: Boolean(opts?.success),
    noOpDetected: !opts?.success,
    visibleApplySucceeded: Boolean(opts?.success),
    finalMatchesSourceAfterNormalization: !opts?.success,
    independentFinalDurationClaimCount: 1,
    durationValidationPassed: true,
    finalValidatedCandidateHash: 'final-hash-test',
  });
  if (opts?.success) {
    session.recordVisibleApply(true, 1, 'safe meaningful summary text.');
    session.patch({ countedAsSuccess: true, visibleApplySucceeded: true });
  } else {
    session.recordVisibleApply(false, 0);
    session.patch({
      countedAsSuccess: false,
      finalTypedFailureReason: opts?.reason ?? 'summary_noop_after_normalization',
    });
  }
  return session.commit();
}

function commitMinimalExperience(opts?: {
  requestId?: string;
  reason?: string | null;
  success?: boolean;
}): ReturnType<ExperienceAiDiagnosticSession['commit']> {
  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'hi',
    requestedLocale: 'hi',
    contentLocale: 'hi',
    templateId: 'modern',
    gender: 'female',
    requestId: opts?.requestId || `exp-${Math.random().toString(36).slice(2)}`,
    usageCountBefore: 0,
    jobContextHash: 'job-ctx-test',
  });
  session.patch({
    countedAsSuccess: Boolean(opts?.success),
    finalTypedFailureReason: opts?.reason ?? (opts?.success ? null : 'experience_ai_noop'),
    visibleApplySucceeded: Boolean(opts?.success),
  });
  session.recordVisibleApply(Boolean(opts?.success), opts?.success ? 1 : 0);
  return session.commit();
}

describe('CV AI diagnostics lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
    localStorage.setItem(
      AI_USAGE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        windowStart: Date.now(),
        count: 3,
        policyLimit: 50,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
  });

  it('exposes lifecycle marker for asset verification', () => {
    expect(CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER).toBe('internal-diagnostics-lifecycle-v1');
    expect(CV_AI_DIAGNOSTICS_CHANGED_EVENT).toBe('cvpro-cv-ai-diagnostics-changed');
  });

  it('clear Summary latest removes only Summary latest key and preserves usage/Experience/history', () => {
    const sum = commitMinimalSummary({ requestId: 's1', reason: 'summary_noop_after_normalization' });
    const exp = commitMinimalExperience({ requestId: 'e1', success: true });
    expect(getCvAiDiagnosticHistory('summary').length).toBeGreaterThan(0);
    expect(getCvAiDiagnosticHistory('experience').length).toBeGreaterThan(0);
    const before = snapshotDiagKeys();
    expect(before[SUMMARY_AI_DIAG_STORAGE_KEY]).toBeTruthy();
    expect(before[EXPERIENCE_AI_DIAG_STORAGE_KEY]).toBeTruthy();

    clearSummaryAiDiagnostics();

    const after = snapshotDiagKeys();
    expect(after[SUMMARY_AI_DIAG_STORAGE_KEY]).toBeNull();
    expect(after[EXPERIENCE_AI_DIAG_STORAGE_KEY]).toBe(before[EXPERIENCE_AI_DIAG_STORAGE_KEY]);
    expect(after[CV_AI_DIAG_HISTORY_STORAGE_KEY]).toBe(before[CV_AI_DIAG_HISTORY_STORAGE_KEY]);
    expect(after[AI_USAGE_STORAGE_KEY]).toBe(before[AI_USAGE_STORAGE_KEY]);
    expect(getLatestSummaryAiDiagnostic()).toBeNull();
    expect(getLatestExperienceAiDiagnostic()?.requestIdHash).toBe(exp.requestIdHash);
    expect(sum.requestIdHash).toBeTruthy();
  });

  it('clear Experience latest removes only Experience latest key', () => {
    commitMinimalSummary({ requestId: 's2', success: true });
    commitMinimalExperience({ requestId: 'e2', reason: 'experience_ai_noop' });
    const before = snapshotDiagKeys();
    clearExperienceAiDiagnostics();
    const after = snapshotDiagKeys();
    expect(after[EXPERIENCE_AI_DIAG_STORAGE_KEY]).toBeNull();
    expect(after[SUMMARY_AI_DIAG_STORAGE_KEY]).toBe(before[SUMMARY_AI_DIAG_STORAGE_KEY]);
    expect(after[CV_AI_DIAG_HISTORY_STORAGE_KEY]).toBe(before[CV_AI_DIAG_HISTORY_STORAGE_KEY]);
    expect(after[AI_USAGE_STORAGE_KEY]).toBe(before[AI_USAGE_STORAGE_KEY]);
  });

  it('clear Summary history preserves latest and Experience history', () => {
    commitMinimalSummary({ requestId: 's3' });
    commitMinimalExperience({ requestId: 'e3' });
    const before = snapshotDiagKeys();
    clearCvAiDiagnosticHistory('summary');
    const after = snapshotDiagKeys();
    expect(getCvAiDiagnosticHistory('summary')).toEqual([]);
    expect(getCvAiDiagnosticHistory('experience').length).toBeGreaterThan(0);
    expect(after[SUMMARY_AI_DIAG_STORAGE_KEY]).toBe(before[SUMMARY_AI_DIAG_STORAGE_KEY]);
    expect(after[EXPERIENCE_AI_DIAG_STORAGE_KEY]).toBe(before[EXPERIENCE_AI_DIAG_STORAGE_KEY]);
    expect(after[AI_USAGE_STORAGE_KEY]).toBe(before[AI_USAGE_STORAGE_KEY]);
  });

  it('clear Experience history preserves latest and Summary history', () => {
    commitMinimalSummary({ requestId: 's4' });
    commitMinimalExperience({ requestId: 'e4' });
    clearCvAiDiagnosticHistory('experience');
    expect(getCvAiDiagnosticHistory('experience')).toEqual([]);
    expect(getCvAiDiagnosticHistory('summary').length).toBeGreaterThan(0);
    expect(getLatestSummaryAiDiagnostic()).toBeTruthy();
    expect(getLatestExperienceAiDiagnostic()).toBeTruthy();
  });

  it('commit emits same-window Summary/Experience scoped events', () => {
    const seen: string[] = [];
    const unsub = subscribeCvAiDiagnosticsChanged((e) => {
      // listener is () => void — capture via custom event
    });
    unsub();
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      seen.push(`${d.kind}:${d.action}`);
    };
    window.addEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, handler);
    commitMinimalSummary({ requestId: 'evt-s' });
    commitMinimalExperience({ requestId: 'evt-e' });
    clearSummaryAiDiagnostics();
    clearExperienceAiDiagnostics();
    clearCvAiDiagnosticHistory('summary');
    window.removeEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, handler);
    expect(seen).toContain('summary:commit');
    expect(seen).toContain('experience:commit');
    expect(seen).toContain('summary:clear_latest');
    expect(seen).toContain('experience:clear_latest');
    expect(seen).toContain('summary:clear_history');
  });

  it('double commit is idempotent and does not duplicate history', () => {
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 't',
      gender: '',
      requestId: 'idem-1',
      usageCountBefore: 0,
      operationMode: 'enhance_existing_content',
    });
    session.recordVisibleApply(false, 0);
    session.patch({ finalTypedFailureReason: 'summary_noop_after_normalization', noOpDetected: true });
    const first = session.commit();
    const second = session.commit();
    expect(second).toBe(first);
    expect(getCvAiDiagnosticHistory('summary')).toHaveLength(1);
  });

  it('AAB-300 clear → Summary no-op commit restores latest + Copy; Experience unchanged', async () => {
    const oldSum = commitMinimalSummary({
      requestId: 'old-sum',
      reason: 'summary_noop_after_normalization',
    });
    const exp = commitMinimalExperience({ requestId: 'keep-exp', success: true });
    const { InternalSummaryAiDiagnosticsPanel } = await import(
      '@/components/InternalSummaryAiDiagnosticsPanel'
    );
    const { InternalExperienceAiDiagnosticsPanel } = await import(
      '@/components/InternalExperienceAiDiagnosticsPanel'
    );
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(InternalSummaryAiDiagnosticsPanel, { refreshToken: 1 }),
        React.createElement(InternalExperienceAiDiagnosticsPanel, { refreshToken: 1 }),
      ),
    );
    expect(screen.getByTestId('summary-ai-diagnostics-copy')).toBeTruthy();
    expect(screen.getByTestId('experience-ai-diagnostics-copy')).toBeTruthy();

    fireEvent.click(screen.getByTestId('summary-ai-diagnostics-clear'));
    await waitFor(() => {
      expect(screen.queryByTestId('summary-ai-diagnostics-copy')).toBeNull();
    });
    expect(screen.getByTestId('experience-ai-diagnostics-copy')).toBeTruthy();
    expect(getLatestExperienceAiDiagnostic()?.requestIdHash).toBe(exp.requestIdHash);

    const next = commitMinimalSummary({
      requestId: 'aab300-noop',
      reason: 'summary_noop_after_normalization',
    });
    expect(next.finalTypedFailureReason).toBe('summary_noop_after_normalization');
    expect(next.capturedAt).not.toBe(oldSum.capturedAt);
    await waitFor(() => {
      expect(screen.getByTestId('summary-ai-diagnostics-copy')).toBeTruthy();
    });
    expect(getLatestExperienceAiDiagnostic()?.requestIdHash).toBe(exp.requestIdHash);

    // Restart: wipe in-memory, keep storage
    const rawSum = localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY);
    const rawExp = localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    localStorage.setItem(SUMMARY_AI_DIAG_STORAGE_KEY, rawSum || '');
    localStorage.setItem(EXPERIENCE_AI_DIAG_STORAGE_KEY, rawExp || '');
    cleanup();
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(InternalSummaryAiDiagnosticsPanel, { refreshToken: 2 }),
        React.createElement(InternalExperienceAiDiagnosticsPanel, { refreshToken: 2 }),
      ),
    );
    expect(getLatestSummaryAiDiagnostic()?.requestIdHash).toBe(next.requestIdHash);
    expect(getLatestExperienceAiDiagnostic()?.requestIdHash).toBe(exp.requestIdHash);
    expect(screen.getByTestId('summary-ai-diagnostics-copy')).toBeTruthy();
    expect(screen.getByTestId('experience-ai-diagnostics-copy')).toBeTruthy();
  });

  it('clear → Summary success and failure both restore Copy', async () => {
    commitMinimalSummary({ requestId: 'seed' });
    const { InternalSummaryAiDiagnosticsPanel } = await import(
      '@/components/InternalSummaryAiDiagnosticsPanel'
    );
    render(React.createElement(InternalSummaryAiDiagnosticsPanel, { refreshToken: 1 }));
    fireEvent.click(screen.getByTestId('summary-ai-diagnostics-clear'));
    await waitFor(() => expect(screen.queryByTestId('summary-ai-diagnostics-copy')).toBeNull());

    commitMinimalSummary({ requestId: 'ok', success: true });
    await waitFor(() => expect(screen.getByTestId('summary-ai-diagnostics-copy')).toBeTruthy());
    expect(getLatestSummaryAiDiagnostic()?.countedAsSuccess).toBe(true);

    fireEvent.click(screen.getByTestId('summary-ai-diagnostics-clear'));
    commitMinimalSummary({ requestId: 'fail', reason: 'network_error' });
    await waitFor(() => expect(screen.getByTestId('summary-ai-diagnostics-copy')).toBeTruthy());
    expect(getLatestSummaryAiDiagnostic()?.finalTypedFailureReason).toBe('network_error');
  });

  it('clear → Experience success/no-op restores Copy without touching Summary', async () => {
    const sum = commitMinimalSummary({ requestId: 'sum-keep', success: true });
    commitMinimalExperience({ requestId: 'exp-seed' });
    const { InternalExperienceAiDiagnosticsPanel } = await import(
      '@/components/InternalExperienceAiDiagnosticsPanel'
    );
    render(React.createElement(InternalExperienceAiDiagnosticsPanel, { refreshToken: 1 }));
    fireEvent.click(screen.getByTestId('experience-ai-diagnostics-clear'));
    await waitFor(() => expect(screen.queryByTestId('experience-ai-diagnostics-copy')).toBeNull());
    expect(getLatestSummaryAiDiagnostic()?.requestIdHash).toBe(sum.requestIdHash);

    commitMinimalExperience({ requestId: 'exp-ok', success: true });
    await waitFor(() => expect(screen.getByTestId('experience-ai-diagnostics-copy')).toBeTruthy());
    expect(getLatestSummaryAiDiagnostic()?.requestIdHash).toBe(sum.requestIdHash);

    fireEvent.click(screen.getByTestId('experience-ai-diagnostics-clear'));
    commitMinimalExperience({ requestId: 'exp-noop', reason: 'experience_ai_noop' });
    await waitFor(() => expect(screen.getByTestId('experience-ai-diagnostics-copy')).toBeTruthy());
    expect(getLatestSummaryAiDiagnostic()?.requestIdHash).toBe(sum.requestIdHash);
  });

  it('corrupt Summary latest does not remove valid Experience latest', () => {
    commitMinimalExperience({ requestId: 'exp-ok2', success: true });
    localStorage.setItem(SUMMARY_AI_DIAG_STORAGE_KEY, '{not-json');
    expect(getLatestSummaryAiDiagnostic()).toBeNull();
    expect(getLatestExperienceAiDiagnostic()?.requestIdHash).toBeTruthy();
    expect(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY)).toBeNull();
  });

  it('corrupt Experience latest does not remove valid Summary latest', () => {
    commitMinimalSummary({ requestId: 'sum-ok2', success: true });
    localStorage.setItem(EXPERIENCE_AI_DIAG_STORAGE_KEY, '{not-json');
    expect(getLatestExperienceAiDiagnostic()).toBeNull();
    expect(getLatestSummaryAiDiagnostic()?.requestIdHash).toBeTruthy();
  });

  it('corrupt shared history does not break latest records', () => {
    commitMinimalSummary({ requestId: 's-hist' });
    commitMinimalExperience({ requestId: 'e-hist' });
    localStorage.setItem(CV_AI_DIAG_HISTORY_STORAGE_KEY, '{broken');
    expect(getCvAiDiagnosticHistory()).toEqual([]);
    expect(getLatestSummaryAiDiagnostic()).toBeTruthy();
    expect(getLatestExperienceAiDiagnostic()).toBeTruthy();
  });

  it('history remains bounded at 5+5', () => {
    for (let i = 0; i < 7; i += 1) {
      commitMinimalSummary({ requestId: `s-bound-${i}` });
      commitMinimalExperience({ requestId: `e-bound-${i}` });
    }
    expect(getCvAiDiagnosticHistory('summary')).toHaveLength(5);
    expect(getCvAiDiagnosticHistory('experience')).toHaveLength(5);
  });

  it('Copy payload is the newest Summary record, never Experience', async () => {
    commitMinimalExperience({ requestId: 'exp-copy', success: true });
    const sum = commitMinimalSummary({ requestId: 'sum-copy', success: true });
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { copySummaryAiDiagnosticsToClipboard } = await import('@/lib/cv-summary-ai-diagnostics');
    const { copyExperienceAiDiagnosticsToClipboard } = await import('@/lib/cv-experience-ai-diagnostics');
    expect(await copySummaryAiDiagnosticsToClipboard()).toBe(true);
    expect(writeText.mock.calls[0][0]).toContain(sum.requestIdHash);
    expect(writeText.mock.calls[0][0]).toContain('"operationKind": "summary"');
    expect(writeText.mock.calls[0][0]).not.toContain('"operationKind": "experience"');
    writeText.mockClear();
    expect(await copyExperienceAiDiagnosticsToClipboard()).toBe(true);
    expect(writeText.mock.calls[0][0]).toContain('"operationKind": "experience"');
    expect(writeText.mock.calls[0][0]).not.toContain('"operationKind": "summary"');
  });

  it('listener cleanup prevents duplicate same-window notifications', () => {
    const counts = { n: 0 };
    const unsub = subscribeCvAiDiagnosticsChanged(() => {
      counts.n += 1;
    }, { kind: 'summary' });
    emitCvAiDiagnosticsChanged({ kind: 'summary', action: 'commit' });
    expect(counts.n).toBe(1);
    unsub();
    emitCvAiDiagnosticsChanged({ kind: 'summary', action: 'commit' });
    expect(counts.n).toBe(1);
  });

  it('cross-window storage event reloads via subscription', async () => {
    const { InternalSummaryAiCopyLink } = await import(
      '@/components/InternalSummaryAiDiagnosticsPanel'
    );
    render(React.createElement(InternalSummaryAiCopyLink));
    expect(screen.queryByTestId('summary-ai-copy-diagnostics')).toBeNull();
    const trace = commitMinimalSummary({ requestId: 'storage-evt' });
    // Simulate another document writing storage (CustomEvent already fired by commit;
    // also dispatch StorageEvent for cross-window path).
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SUMMARY_AI_DIAG_STORAGE_KEY,
          newValue: JSON.stringify(trace),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('summary-ai-copy-diagnostics')).toBeTruthy();
    });
  });
});
