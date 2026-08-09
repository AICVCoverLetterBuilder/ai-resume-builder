/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearSummaryAiDiagnosticsForTests,
  getLatestSummaryAiDiagnostic,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';

import {
  AI_DIAGNOSTICS_TERMINALIZER_REVISION,
  terminalizeAiDiagnosticSession,
} from '@/lib/cv-ai-diagnostics-terminalize';

type RewriteStyle = 'shorter' | 'stronger' | 'professional';

function session(style: RewriteStyle, requestId: string) {
  return new SummaryAiDiagnosticSession({
    uiLocale: 'es',
    requestedLocale: 'es',
    contentLocale: 'es',
    templateId: 'modern-minimal',
    gender: 'female',
    requestId,
    usageCountBefore: 15,
    operationMode: 'enhance_existing_content',
    rewriteStyle: style,
  });
}

describe('AAB-412 terminal AI diagnostics lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
  });

  it('commits even when version enrichment fails', async () => {
    const committed = { marker: 'terminal-trace' };

    const fake = {
      resolveVersions: vi.fn().mockRejectedValue(
        new Error('simulated version lookup failure'),
      ),
      commit: vi.fn(() => committed),
    };

    const result = await terminalizeAiDiagnosticSession(fake);

    expect(fake.resolveVersions).toHaveBeenCalledTimes(1);
    expect(fake.commit).toHaveBeenCalledTimes(1);
    expect(result).toBe(committed);
  });

  it.each<RewriteStyle>([
    'shorter',
    'stronger',
    'professional',
  ])(
    'failed %s attempt replaces the old latest diagnostic and remains +0 usage',
    async (style) => {
      const old = session('shorter', 'old-shorter');

      old.patch({
        finalTypedFailureReason: 'summary_noop_after_normalization',
        rejectionStage: 'finalize',
        countedAsSuccess: false,
        usageCountAfter: 15,
      });
      old.recordVisibleApply(false, 15);

      const oldTrace = old.commit();

      const current = session(style, `failed-${style}`);

      current.stage(
        'localization',
        'fail',
        'localization_provider_failed',
      );
      current.patch({
        finalTypedFailureReason: 'localization_provider_failed',
        rejectionStage: 'localization',
        countedAsSuccess: false,
        usageCountAfter: 15,
      });
      current.recordVisibleApply(false, 15);

      const currentTrace =
        await terminalizeAiDiagnosticSession(current);

      expect(currentTrace).not.toBeNull();

      const latest = getLatestSummaryAiDiagnostic();

      expect(latest).not.toBeNull();
      expect(latest?.rewriteStyle).toBe(style);

      expect(latest?.requestIdHash).toBe(
        currentTrace?.requestIdHash,
      );

      expect(latest?.requestIdHash).not.toBe(
        oldTrace.requestIdHash,
      );

      expect(latest?.finalTypedFailureReason)
        .toBe('localization_provider_failed');

      expect(latest?.rejectionStage)
        .toBe('localization');

      expect(latest?.countedAsSuccess).toBe(false);
      expect(latest?.visibleApplySucceeded).toBe(false);
      expect(latest?.usageCountBefore).toBe(15);
      expect(latest?.usageCountAfter).toBe(15);
    },
  );

  it('production page terminalizes Generate, Experience and Rewrite from finally', () => {
    const page = readFileSync(
      'src/app/cv-builder/page.tsx',
      'utf8',
    );

    const generateStart =
      page.indexOf('const handleGenSummary = async');
    const experienceStart =
      page.indexOf('const handleGenBullets = async');
    const rewriteStart =
      page.indexOf('const handleRewrite = async');
    const rewriteEnd =
      page.indexOf('const handleAnalyzeJob', rewriteStart);

    expect(generateStart).toBeGreaterThan(-1);
    expect(experienceStart).toBeGreaterThan(generateStart);
    expect(rewriteStart).toBeGreaterThan(experienceStart);
    expect(rewriteEnd).toBeGreaterThan(rewriteStart);

    const generate =
      page.slice(generateStart, experienceStart);
    const experience =
      page.slice(experienceStart, rewriteStart);
    const rewrite =
      page.slice(rewriteStart, rewriteEnd);

    expect(generate).toContain(
      '} finally {\n      await terminalizeAiDiagnosticSession(summaryDiag);',
    );

    expect(experience).toContain(
      '} finally {\n      await terminalizeAiDiagnosticSession(diagSession);',
    );

    expect(rewrite).toContain(
      '} finally {\n      await terminalizeAiDiagnosticSession(summaryDiag);',
    );

    expect(
      rewrite.indexOf(
        'await terminalizeAiDiagnosticSession(summaryDiag);',
      ),
    ).toBeLessThan(
      rewrite.indexOf('setRewritingStyle(null);'),
    );
  });

  it('publishes the permanent lifecycle revision marker', () => {
    expect(AI_DIAGNOSTICS_TERMINALIZER_REVISION)
      .toBe('ai-diagnostics-terminalizer-412-v1');
  });
});
