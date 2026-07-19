/**
 * @vitest-environment jsdom
 *
 * Mobile modal layout / accessibility for the internal AI usage reset panel.
 * Complements Playwright viewport tests when Chromium is available.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AI_USAGE_SCHEMA_VERSION, AI_USAGE_STORAGE_KEY, PRO_AI_SAFETY_CAP } from '@/lib/ai-usage-policy';
import { CV_DRAFT_STORAGE_KEY } from '@/lib/draft-storage';

function setCompiledGate(value: 'true' | 'false') {
  process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED = value;
}

async function loadEnabledModal() {
  vi.resetModules();
  setCompiledGate('true');
  return import('@/components/CvExportDiagnosticsControls');
}

const CV_FIXTURE = JSON.stringify({
  cv: { personal: { fullName: 'Layout Fixture' }, experience: [] },
  savedAt: '2026-07-18T00:00:00.000Z',
});

function seedCap() {
  localStorage.setItem(
    AI_USAGE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: AI_USAGE_SCHEMA_VERSION,
      count: PRO_AI_SAFETY_CAP,
      windowStart: Date.now(),
      policyLimit: PRO_AI_SAFETY_CAP,
    }),
  );
}

describe('diagnostics modal mobile accessibility (component)', () => {
  const prev = process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED;

  beforeEach(() => {
    localStorage.clear();
    seedCap();
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, CV_FIXTURE);
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', 'tok');
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED = prev;
    vi.resetModules();
    localStorage.clear();
  });

  it('uses flex shell with scrollable body; reset sits above JSON; footer is shrink-0', async () => {
    const mod = await loadEnabledModal();
    render(<mod.CvExportDiagnosticsModal open onClose={() => {}} />);

    const dialog = await screen.findByTestId('cv-export-diagnostics-dialog');
    expect(dialog.className).toMatch(/flex/);
    expect(dialog.className).toMatch(/flex-col/);
    expect(dialog.style.maxHeight).toMatch(/100dvh/);

    const body = screen.getByTestId('cv-export-diagnostics-body');
    expect(body.className).toMatch(/min-h-0/);
    expect(body.className).toMatch(/flex-1/);
    expect(body.className).toMatch(/overflow-y-auto/);

    const panel = await screen.findByTestId('internal-ai-usage-reset-panel');
    expect(body.contains(panel)).toBe(true);

    const btn = screen.getByTestId('internal-ai-usage-reset-button');
    expect(btn.className).toMatch(/min-h-11/);
    expect(getComputedStyle(btn).pointerEvents).not.toBe('none');

    // JSON starts collapsed on internal builds.
    expect(screen.queryByTestId('cv-export-diagnostics-json')).toBeNull();
    fireEvent.click(screen.getByTestId('cv-export-diagnostics-toggle-json'));
    expect(screen.getByTestId('cv-export-diagnostics-json')).toBeTruthy();
  }, 20_000);

  it('reset → confirm portal → count 0; CV/Pro preserved; modal stays open', async () => {
    const mod = await loadEnabledModal();
    const policy = await import('@/lib/ai-usage-policy');
    render(<mod.CvExportDiagnosticsModal open onClose={() => {}} />);

    await screen.findByTestId('internal-ai-usage-reset-button');
    fireEvent.click(screen.getByTestId('internal-ai-usage-reset-button'));

    const confirm = await screen.findByTestId('internal-ai-usage-reset-confirm-dialog');
    expect(confirm.parentElement).toBe(document.body);
    fireEvent.click(within(confirm).getByTestId('internal-ai-usage-reset-confirm'));

    expect(policy.getProAiUsageCount()).toBe(0);
    expect((await screen.findByTestId('internal-ai-usage-count')).textContent).toMatch(/count:\s*0/);
    expect(screen.getByTestId('cv-export-diagnostics-dialog')).toBeTruthy();
    expect(localStorage.getItem(CV_DRAFT_STORAGE_KEY)).toBe(CV_FIXTURE);
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(localStorage.getItem('cvpro-pro-token')).toBe('tok');
  }, 20_000);

  it('production gate false: no reset panel or button classes in tree', async () => {
    vi.resetModules();
    setCompiledGate('false');
    const mod = await import('@/components/CvExportDiagnosticsControls');
    render(<mod.CvExportDiagnosticsModal open onClose={() => {}} />);
    expect(screen.queryByTestId('internal-ai-usage-reset-panel')).toBeNull();
    expect(screen.queryByTestId('internal-ai-usage-reset-button')).toBeNull();
    expect(screen.getByTestId('cv-export-diagnostics-json')).toBeTruthy();
  });
});
