/**
 * Non-mutating export integrity audit for AI-managed CV content.
 * Observes only — does not rewrite. Export callers may block on failure.
 */
import type { CVData } from './types';
import type { Locale } from './i18n/translations';
import { countSummaryDurationExpressions } from './cv-summary-duration-ownership';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { detectTextLocale } from './cv-content-locale';
import {
  softDomainClusterFromPosition,
  validateCrossEntryExperienceLeakage,
  hashExperienceEntryId,
} from './cv-experience-entry-isolation';
import { fingerprintText } from './cv-export-diagnostics';

export type ExportIntegrityEntryResult = {
  entryIdHash: string;
  ok: boolean;
  wrongLocaleBulletCount: number;
  wrongScriptBulletCount: number;
  mixedLanguageBulletCount: number;
  targetLocalePurityPassed: boolean;
  crossEntryLeakageDetected: boolean;
  crossDomainLeakageDetected: boolean;
  reasons: string[];
};

export type ExportIntegrityAuditResult = {
  ok: boolean;
  locale: Locale;
  summaryOk: boolean;
  summaryDurationClaimCount: number;
  summaryTargetLocalePurityPassed: boolean;
  entries: ExportIntegrityEntryResult[];
  reasons: string[];
  marker: 'CVPRO_EXPORT_INTEGRITY_V1';
};

/**
 * Read-only integrity audit over AI-visible Summary + Experience.
 * Does not mutate `cv`. Proper nouns / technical tokens are handled inside
 * unit-locale purity (stripped before language cues).
 *
 * Each AI-managed Experience entry is validated against its *applied* content
 * locale (generatedLocale / entry metadata), not blindly against the current
 * UI locale — so a mid switch (one entry translated, another still source)
 * does not false-fail export. Mixed-language units always fail.
 */
export function auditCvExportIntegrity(
  cv: CVData,
  locale: Locale,
  options?: { requireSummaryDuration?: boolean },
): ExportIntegrityAuditResult {
  const reasons: string[] = [];
  const summary = (cv.summary || '').trim();
  const summaryLocale = (
    (cv.summaryGeneratedLocale as Locale | undefined)
    || (cv.contentLocale as Locale | undefined)
    || locale
  ) as Locale;
  const summaryPurity = summary
    ? validateAiUnitLocalePurity(summary, summaryLocale, {
      kind: 'summary_sentence',
      requireUnits: true,
    })
    : {
      ok: true,
      targetLocalePurityPassed: true,
      wrongLocaleUnitCount: 0,
      wrongScriptUnitCount: 0,
      mixedLanguageUnitCount: 0,
    };
  const durationCount = countSummaryDurationExpressions(summary, summaryLocale);
  const requireDuration = options?.requireSummaryDuration !== false
    && Boolean(cv.summaryOrigin && cv.summaryOrigin !== 'user');
  let summaryOk = summaryPurity.ok;
  if (summary && !summaryPurity.ok) {
    reasons.push('summary_locale_impurity');
    summaryOk = false;
  }
  if (requireDuration && summary && durationCount !== 1) {
    reasons.push('summary_duration_count');
    summaryOk = false;
  }

  const entries: ExportIntegrityEntryResult[] = [];
  for (const exp of cv.experience || []) {
    const desc = (exp.description || '').trim();
    const entryReasons: string[] = [];
    if (!desc) {
      entries.push({
        entryIdHash: hashExperienceEntryId(exp.id),
        ok: true,
        wrongLocaleBulletCount: 0,
        wrongScriptBulletCount: 0,
        mixedLanguageBulletCount: 0,
        targetLocalePurityPassed: true,
        crossEntryLeakageDetected: false,
        crossDomainLeakageDetected: false,
        reasons: [],
      });
      continue;
    }
    // Only audit AI-managed descriptions — user-authored free text is exempt
    // from strict target-locale purity (manual multilingual CVs are allowed).
    const aiManaged = exp.descriptionOrigin === 'ai_generated'
      || exp.descriptionOrigin === 'ai_repaired'
      || exp.descriptionOrigin === 'deterministic_fallback'
      || Boolean((exp.generatedDescription || '').trim());
    const stampedLocale = (
      (exp.generatedLocale as Locale | undefined)
      || ((exp as { contentLocale?: string }).contentLocale as Locale | undefined)
      || (cv.contentLocale as Locale | undefined)
      || locale
    ) as Locale;
    // Prefer the language actually present in the visible unit. Stamps can lag
    // during partial locale switches / export projection.
    const detectedDisplay = detectTextLocale(desc, {
      storedLocale: stampedLocale,
      generatedLocale: exp.generatedLocale,
    });
    const entryLocale = (
      detectedDisplay !== 'unknown' ? detectedDisplay : stampedLocale
    ) as Locale;
    const purity = validateAiUnitLocalePurity(desc, entryLocale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    const leakage = validateCrossEntryExperienceLeakage({
      cv,
      targetExperienceId: exp.id,
      candidate: desc,
      targetPosition: exp.position,
    });
    const titleCluster = softDomainClusterFromPosition(exp.position || '');
    let crossDomain = false;
    if (titleCluster === 'visual_design' && !leakage.ok) {
      crossDomain = leakage.foreignClusters.includes('warehouse_goods');
    }
    if (titleCluster === 'warehouse_goods' && !leakage.ok) {
      crossDomain = leakage.foreignClusters.includes('visual_design');
    }

    if (aiManaged && !purity.ok) {
      entryReasons.push(purity.reason || 'locale_impurity');
    }
    if (!leakage.ok) {
      entryReasons.push(leakage.reason || 'cross_entry_fact_leakage');
    }

    const ok = entryReasons.length === 0;
    if (!ok) reasons.push(`entry:${fingerprintText(exp.id || '').slice(0, 8)}`);
    entries.push({
      entryIdHash: hashExperienceEntryId(exp.id),
      ok,
      wrongLocaleBulletCount: aiManaged ? purity.wrongLocaleUnitCount : 0,
      wrongScriptBulletCount: aiManaged ? purity.wrongScriptUnitCount : 0,
      mixedLanguageBulletCount: aiManaged ? purity.mixedLanguageUnitCount : 0,
      targetLocalePurityPassed: aiManaged ? purity.targetLocalePurityPassed : true,
      crossEntryLeakageDetected: !leakage.ok,
      crossDomainLeakageDetected: crossDomain,
      reasons: entryReasons,
    });
  }

  const ok = summaryOk && entries.every((e) => e.ok);
  return {
    ok,
    locale,
    summaryOk,
    summaryDurationClaimCount: durationCount,
    summaryTargetLocalePurityPassed: summaryPurity.targetLocalePurityPassed,
    entries,
    reasons,
    marker: 'CVPRO_EXPORT_INTEGRITY_V1',
  };
}
