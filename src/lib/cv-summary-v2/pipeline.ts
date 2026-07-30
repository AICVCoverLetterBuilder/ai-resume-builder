import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { hasAiProtocolMarker } from '@/lib/cv-ai-protocol-strip';
import { SUMMARY_V2_REVISION, isSummaryV2Enabled } from './flag';
import { captureSummaryV2Snapshot } from './snapshot';
import { buildSummaryV2SelectionManifest } from './manifest';
import { buildSummaryV2DeterministicText } from './builder';
import { validateSummaryV2AgainstManifest } from './validator';
import { bulletToWhereClauseEn, dutyTenseFromEmploymentState } from './tense';
import type { SummaryV2PipelineResult, SummaryV2SelectionManifest } from './types';

export type RunSummaryV2Options = {
  cv: CVData;
  locale: Locale;
  gender?: string;
  candidate?: string;
  referenceDateIso: string;
  /** Existing Summary may guide style only; never factual authority. */
  styleHintFromExistingSummary?: boolean;
};

function prepareCandidate(raw: string): string {
  let t = (raw || '').trim();
  if (hasAiProtocolMarker(t)) t = '';
  return t.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Repair duty tense to match each manifest entry's employmentState.
 * Does not invent facts — only swaps present↔past clause forms already owned
 * by the selection manifest.
 */
export function repairSummaryV2DutyTense(
  candidate: string,
  manifest: SummaryV2SelectionManifest,
): string {
  let t = candidate || '';
  const entries = [
    ...(manifest.current ? [manifest.current] : []),
    ...manifest.priors,
  ];
  for (const entry of entries) {
    const facts = [
      ...manifest.requiredCurrentFacts,
      ...manifest.requiredPriorFacts,
    ].filter((f) => f.entryId === entry.entryId);
    const want = dutyTenseFromEmploymentState(entry.employmentState);
    const other = want === 'past' ? 'present' : 'past';
    for (const f of facts) {
      const correct = bulletToWhereClauseEn(f.bulletText, want);
      const wrong = bulletToWhereClauseEn(f.bulletText, other);
      const live = (f.bulletText || '').replace(/[.;]+$/u, '').trim();
      if (correct && wrong && correct.toLowerCase() !== wrong.toLowerCase()) {
        t = t.replace(new RegExp(escapeRegExp(wrong), 'giu'), correct);
      }
      if (want === 'past' && correct && live && live.toLowerCase() !== correct.toLowerCase()) {
        t = t.replace(new RegExp(escapeRegExp(live), 'giu'), correct);
      }
    }
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Full V2 Summary pipeline: snapshot → manifest → provider/repair/deterministic
 * against the same manifest → shared validator.
 */
export function runSummaryV2(options: RunSummaryV2Options): SummaryV2PipelineResult {
  void SUMMARY_V2_REVISION;
  const snapshot = captureSummaryV2Snapshot({
    cv: options.cv,
    locale: options.locale,
    gender: options.gender,
    referenceDateIso: options.referenceDateIso,
  });
  const manifest = buildSummaryV2SelectionManifest(snapshot);

  const provider = prepareCandidate(options.candidate || '');
  let text = '';
  let origin: SummaryV2PipelineResult['origin'] = 'deterministic_fallback';

  if (provider) {
    const providerQ = validateSummaryV2AgainstManifest(provider, manifest);
    if (providerQ.ok) {
      text = provider;
      origin = 'ai_generated';
    } else {
      const repaired = repairSummaryV2DutyTense(provider, manifest);
      const repairQ = validateSummaryV2AgainstManifest(repaired, manifest);
      if (repairQ.ok) {
        text = repaired;
        origin = 'ai_repaired';
      }
    }
  }

  if (!text) {
    text = buildSummaryV2DeterministicText(manifest);
    origin = 'deterministic_fallback';
  }

  const validation = validateSummaryV2AgainstManifest(text, manifest);
  if (!validation.ok) {
    return {
      blocked: true,
      reason: validation.reason || 'summary_v2_validation_failed',
      text: '',
      origin,
      countedAsSuccess: false,
      manifest,
      validation,
      snapshot,
    };
  }

  return {
    blocked: false,
    text,
    origin,
    countedAsSuccess: true,
    manifest,
    validation,
    snapshot,
  };
}

/** Build the selection manifest alone (for shadow / diagnostics). */
export function buildSummaryV2ManifestForCv(options: {
  cv: CVData;
  locale: Locale;
  gender?: string;
  referenceDateIso: string;
}): SummaryV2SelectionManifest {
  const snapshot = captureSummaryV2Snapshot(options);
  return buildSummaryV2SelectionManifest(snapshot);
}

export function summaryV2Active(): boolean {
  return isSummaryV2Enabled();
}
