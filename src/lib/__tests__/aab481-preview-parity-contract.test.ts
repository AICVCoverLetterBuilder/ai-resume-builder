import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import {
  buildPreviewSummarySnapshotId,
  commitPreviewSummaryLeafEvidence,
  describePreviewSummaryRender,
  sameSnapshotPreviewParityFailure,
  type PreviewSummaryRenderEvidence,
} from '@/lib/prepare-export-ready-cv';

function cv(summary: string): CVData {
  return {
    id: 'aab481-parity', name: 'AAB481',
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '', gender: 'female' },
    summary, summaryOrigin: 'deterministic_fallback', summaryGeneratedLocale: 'sr',
    experience: [], education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

describe('AAB481 — locale-neutral Preview leaf and same-snapshot parity contract', () => {
  it.each([
    ['de', 'Erfahrene Fachkraft mit verlässlich gebundenen Aufgaben.'],
    ['ru', 'Опытная специалистка с подтверждёнными обязанностями.'],
    ['hi', 'प्रमाणित जिम्मेदारियों वाली अनुभवी पेशेवर।'],
    ['ar', 'متخصصة ذات خبرة ومسؤوليات موثقة.'],
    ['ja', '確認済みの職務経験を持つ専門職です。'],
  ] as const)('uses the same shared leaf witness for %s', (locale, summary) => {
    const source = cv(summary);
    const snapshotId = buildPreviewSummarySnapshotId(source, locale as Locale);
    const evidence = describePreviewSummaryRender(source, null, false, {
      previewSnapshotId: snapshotId,
      previewInputSummaryHash: hashSummaryV2Text(summary),
    });
    const committed = commitPreviewSummaryLeafEvidence(evidence, summary, `Summary ${summary}`);
    expect(committed.previewSnapshotId).toBe(snapshotId);
    expect(committed.templateLeafSummaryHash).toBe(hashSummaryV2Text(summary));
    expect(committed.previewRenderAuthority).toBe('manual_saved');
    expect(committed.previewSelectedFinalParityPassed).toBeNull();
  });

  it('blocks a selected-final mismatch only for the exact unchanged input snapshot', () => {
    const source = cv('stale saved Summary');
    const selected = 'safe terminal Summary';
    const selectedHash = hashSummaryV2Text(selected);
    const snapshotId = buildPreviewSummarySnapshotId(source, 'sr');
    const intended: PreviewSummaryRenderEvidence = {
      previewRenderedSummaryHash: selectedHash,
      previewRenderAuthority: 'selected_final',
      selectedFinalSummaryHash: selectedHash,
      previewSnapshotId: snapshotId,
      previewInputSummaryHash: hashSummaryV2Text(source.summary),
      templatePreviewSummaryHash: selectedHash,
      templateLeafSummaryHash: null,
      previewSelectedFinalParityPassed: null,
    };
    const mismatched = commitPreviewSummaryLeafEvidence(intended, selected, source.summary);
    expect(mismatched.previewRenderAuthority).toBe('render_mismatch');
    expect(mismatched.previewSelectedFinalParityPassed).toBe(false);
    expect(sameSnapshotPreviewParityFailure({
      evidence: mismatched,
      sourceCv: source,
      locale: 'sr',
      selectedFinalSummaryHash: selectedHash,
    })).toBe(true);
    expect(sameSnapshotPreviewParityFailure({
      evidence: mismatched,
      sourceCv: { ...source, summary: `${source.summary} changed` },
      locale: 'sr',
      selectedFinalSummaryHash: selectedHash,
    })).toBe(false);
    expect(sameSnapshotPreviewParityFailure({
      evidence: mismatched,
      sourceCv: source,
      locale: 'sr',
      selectedFinalSummaryHash: hashSummaryV2Text('a divergent export terminal Summary'),
    })).toBe(true);
    const committedSelected = commitPreviewSummaryLeafEvidence(intended, selected, selected);
    expect(committedSelected.previewRenderAuthority).toBe('selected_final');
    expect(sameSnapshotPreviewParityFailure({
      evidence: committedSelected,
      sourceCv: source,
      locale: 'sr',
      selectedFinalSummaryHash: hashSummaryV2Text('a divergent export terminal Summary'),
    })).toBe(true);
  });
});
