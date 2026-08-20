/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import type { CVData } from '@/lib/types';
import type { PrepareExportReadyResult } from '@/lib/prepare-export-ready-cv';
import {
  buildAndStoreCvExportDiagnostic,
  clearCvExportDiagnosticsForTests,
  copyLatestCvExportDiagnosticsToClipboard,
  getLatestCvExportDiagnostic,
  getCvExportDiagnosticsRevision,
  subscribeCvExportDiagnosticsChanged,
} from '@/lib/cv-export-diagnostics';
import { CvExportDiagnosticsModal } from '@/components/CvExportDiagnosticsControls';

const TERMINAL_SUMMARY_HASH = 'fnv1a_e7f712af';

function corporateNavyCv(): CVData {
  return {
    id: 'aab493-diagnostics-corporate-navy',
    name: 'AAB493 diagnostics',
    personal: {
      fullName: '', email: '', phone: '', address: '', jobTitle: '',
      gender: 'female', photoEnabled: false,
    },
    summary: 'Terminal Serbian summary authority witness.',
    contentLocale: 'sr',
    experience: [], education: [], skills: [], certifications: [], languages: [],
    templateId: 'corporate-navy', region: 'EU',
    createdAt: '2026-08-20T07:00:00.000Z',
    updatedAt: '2026-08-20T07:00:00.000Z',
  } as CVData;
}

function preparedCorporateNavy(): Extract<PrepareExportReadyResult, { ok: true }> {
  const cv = corporateNavyCv();
  return {
    ok: true,
    cv,
    diagnostics: {
      selectedTemplateId: 'corporate-navy',
      selectedFinalSummaryHash: TERMINAL_SUMMARY_HASH,
      selectedFinalSource: 'deterministic_v2_manifest',
      exportSummaryHash: TERMINAL_SUMMARY_HASH,
    },
  } as Extract<PrepareExportReadyResult, { ok: true }>;
}

function commitCurrentPdf(overrides: {
  finalError?: unknown;
  saveResult?: 'saved' | 'failed';
} = {}) {
  const prepared = preparedCorporateNavy();
  return buildAndStoreCvExportDiagnostic({
    format: 'pdf',
    locale: 'sr',
    rawCv: prepared.cv,
    prepared,
    appVersionCode: '493',
    appVersionName: '1.0.493',
    finalError: overrides.finalError,
    rendererReached: true,
    blobProduced: true,
    blobMimeType: 'application/pdf',
    androidSaveReached: true,
    saveResult: { result: overrides.saveResult ?? 'saved', message: 'terminal' },
    previewSummaryRender: {
      previewRenderedSummaryHash: TERMINAL_SUMMARY_HASH,
      previewRenderAuthority: 'selected_final',
      selectedFinalSummaryHash: TERMINAL_SUMMARY_HASH,
      previewInputSummaryHash: TERMINAL_SUMMARY_HASH,
      templatePreviewSummaryHash: TERMINAL_SUMMARY_HASH,
      templateLeafSummaryHash: TERMINAL_SUMMARY_HASH,
    },
    extraStages: [
      { stage: 'render_blob', result: 'ok' },
      { stage: 'android_save', result: overrides.saveResult === 'failed' ? 'fail' : 'ok' },
    ],
  });
}

function seedAab492Latest(): void {
  localStorage.setItem('cvpro-export-diag-pdf', JSON.stringify({
    schemaVersion: 1,
    capturedAt: '2026-08-20T07:04:46.262Z',
    appVersionCode: '492',
    appVersionName: '1.0.492',
    selectedTemplateId: 'creative-artistic',
    exportFormat: 'pdf',
  }));
}

describe('AAB493 export diagnostics latest lifecycle', () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    clearCvExportDiagnosticsForTests();
  });

  it('wires the Corporate Navy terminal save through the shared diagnostic commit', () => {
    const page = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    const start = page.indexOf("if (liveCv.templateId === 'corporate-navy')");
    const end = page.indexOf("if (liveCv.templateId === 'contemporary-bold')", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(page.slice(start, end)).toContain('await recordExportDiagnostic({');
  });

  it('replaces persisted AAB492 latest after an update-install with the completed AAB493 Corporate Navy PDF record', async () => {
    seedAab492Latest();
    // A process restart has no module cache; the persisted AAB492 record is
    // legitimately latest until the first completed AAB493 export.
    expect(getLatestCvExportDiagnostic()).toMatchObject({
      appVersionCode: '492', selectedTemplateId: 'creative-artistic',
    });

    const seen: number[] = [];
    const unsubscribe = subscribeCvExportDiagnosticsChanged(() => {
      seen.push(getCvExportDiagnosticsRevision());
    });
    const trace = commitCurrentPdf();
    unsubscribe();

    expect(trace).toMatchObject({
      appVersionCode: '493', appVersionName: '1.0.493',
      selectedTemplateId: 'corporate-navy', exportFormat: 'pdf',
      rendererReached: true, blobProduced: true, blobMimeType: 'application/pdf',
      androidSaveReached: true, saveResult: 'saved', ok: true,
      selectedFinalSummaryHash: TERMINAL_SUMMARY_HASH,
      selectedFinalSource: 'deterministic_v2_manifest',
      previewRenderedSummaryHash: TERMINAL_SUMMARY_HASH,
      previewInputSummaryHash: TERMINAL_SUMMARY_HASH,
      templatePreviewSummaryHash: TERMINAL_SUMMARY_HASH,
      templateLeafSummaryHash: TERMINAL_SUMMARY_HASH,
      visiblePreviewSummaryHash: TERMINAL_SUMMARY_HASH,
      exportSummaryHash: TERMINAL_SUMMARY_HASH,
    });
    expect(trace.capturedAt).not.toBe('2026-08-20T07:04:46.262Z');
    expect(getLatestCvExportDiagnostic()).toMatchObject({
      appVersionCode: '493', selectedTemplateId: 'corporate-navy',
    });
    expect(seen).toHaveLength(1);
  });

  it('replaces latest with a terminal failure rather than retaining the last successful export', () => {
    commitCurrentPdf();
    const failed = commitCurrentPdf({ finalError: { reason: 'android_file_save_failed' }, saveResult: 'failed' });
    expect(failed.ok).toBe(false);
    expect(getLatestCvExportDiagnostic()).toMatchObject({
      capturedAt: failed.capturedAt,
      finalTypedFailureReason: 'android_file_save_failed',
      ok: false,
    });
  });

  it('keeps Show JSON and Copy diagnostics aligned with a new terminal commit while the panel is already open', async () => {
    seedAab492Latest();
    const copied: string[] = [];
    const writeText = vi.fn(async (text: string) => {
      copied.push(text);
    });
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CvExportDiagnosticsModal open onClose={() => {}} />);
    expect(screen.getByTestId('cv-export-diagnostics-json').textContent).toContain('creative-artistic');

    act(() => { commitCurrentPdf(); });
    await waitFor(() => {
      const json = screen.getByTestId('cv-export-diagnostics-json').textContent || '';
      expect(json).toContain('corporate-navy');
      expect(json).toContain('"493"');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostics' }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(copied[0]).toContain('corporate-navy');
    expect(copied[0]).toContain('"493"');
    expect(await copyLatestCvExportDiagnosticsToClipboard()).toBe(true);
    expect(copied.at(-1)).toContain('corporate-navy');
  });
});
