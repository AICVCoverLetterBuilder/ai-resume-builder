/**
 * Release-safe, non-PII CV export diagnostics for on-device incident traces.
 * Never stores names, companies, emails, phones, or CV prose — only metadata,
 * lengths, one-way hashes, semantic keys, stages, and typed reasons.
 */
import type { CVData, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import { splitExperienceBullets } from './cv-canonical-facts';
import {
  extractCvExportFailureReason,
  formatCvExportIntegrityToast,
} from './cv-export-error-message';
import type { PrepareExportReadyResult, ExportReadyDiagnostics } from './prepare-export-ready-cv';
import type { SaveFileResult } from './native-save';
import {
  buildExperienceDurationSnapshot,
  durationDisplayBucket,
} from './cv-experience-duration';
import type { ExperienceLocalizationDiagnostics } from './cv-experience-localized-surfaces';
import type { ExperiencePresentationRecord } from './cv-experience-localized-surfaces';
import {
  CV_EXPORT_RENDER_DUTY_PROJECTION_REVISION,
  getExperienceExportRenderDescription,
} from './cv-export-structured-text';

export type CvExportFormat = 'pdf' | 'docx';

export type CvExportDiagnosticStageName =
  | 'load_draft'
  | 'migrate_runtime'
  | 'construct_raw_export_snapshot'
  | 'resolve_experience_source_locale'
  | 'lookup_localized_experience_surfaces'
  | 'acquire_localized_experience_surfaces'
  | 'validate_localized_experience_surfaces'
  | 'revalidate_experience_export_snapshot'
  | 'persist_localized_experience_surfaces'
  | 'recover_legacy_grounding'
  | 'construct_semantic_duties'
  | 'project_localized_experience'
  | 'construct_summary_fact_set'
  | 'validate_summary'
  | 'recover_summary'
  | 'validate_locale_integrity'
  | 'prepare_template'
  | 'same_snapshot_preview_parity'
  | 'render_blob'
  | 'android_save';

export type CvExportStageResult = 'entered' | 'ok' | 'fail' | 'skipped';

/** Legacy type retained for callers; runtime values may include newer script families. */
export type BulletScriptClass = 'hi' | 'en' | 'mixed' | 'empty';

export type CvExportToastMappingKey =
  | 'SUMMARY_REGENERATE'
  | 'TITLE_CONFLICT'
  | 'SUMMARY_FACTS_REVIEW'
  | 'EXPERIENCE_FACTS_REVIEW'
  | 'LEGACY_SNAPSHOT_REVIEW'
  | 'FILE_SAVE_FAILED'
  | 'GENERIC_PDF'
  | 'GENERIC_DOCX'
  | 'UNKNOWN';

export type CvExportExperienceDiag = {
  index: number;
  hasOriginalUserDescription: boolean;
  hasCanonicalDescription: boolean;
  hasCanonicalSnapshot: boolean;
  hasGeneratedDescription: boolean;
  hasDescriptionOrigin: boolean;
  hasGeneratedLocale: boolean;
  hasGroundingRecoverySource: boolean;
  originalUserDescriptionLength: number;
  canonicalDescriptionLength: number;
  generatedDescriptionLength: number;
  descriptionLength: number;
  originalUserDescriptionHash: string;
  canonicalDescriptionHash: string;
  generatedDescriptionHash: string;
  descriptionHash: string;
  descriptionOrigin?: string;
  generatedLocale?: string;
  groundingRecoverySource?: string;
  groundingSource: string;
  recoveredSemanticDutyKeys: string[];
  recoveredDutyCount: number;
  visibleLocalizedBulletCount: number;
  canonicalShellCount: number;
  finalProjectedBulletCount: number | null;
  /** Immutable fact-authority script evidence, separate from rendered target bullets. */
  sourceBulletScripts: string[] | null;
  /** Script evidence for the exact final target-presentation bullets. */
  finalPresentationBulletScripts: string[] | null;
  /** @deprecated Alias retained for readers that expect final presentation scripts. */
  finalBulletScripts: string[] | null;
  /** Target-locale projection evidence, stored as metadata/hashes only. */
  presentationSnapshotId: string | null;
  owningEntryHash: string;
  currentVisibleDescriptionHash: string;
  /** Immutable same-entry source/fact locale. */
  sourceLocale: string | null;
  /** Explicit immutable fact-authority locale; `sourceLocale` remains its legacy alias. */
  immutableGroundingLocale: string | null;
  /** Locale of the most recent current/generated display surface. */
  currentPresentationLocale: string | null;
  projectionRequired: boolean | null;
  presentationAuthority: 'current_visible' | 'validated_target_projection' | 'same_entry_semantic_recovery' | 'unresolved' | null;
  recoveryAttempted: boolean | null;
  recoveryKind: 'same_entry_semantic_recovery' | 'validated_target_projection' | null;
  presentationRejectionReason: string | null;
  presentationTargetLocale: string | null;
  presentationHash: string | null;
  finalPresentationHash: string | null;
  presentationRequiredFactCount: number | null;
  presentationCoveredFactCount: number | null;
  presentationMissingFactCount: number | null;
  presentationFactCoveragePassed: boolean | null;
  immutableFactAuthorityHash: string | null;
  finalBulletDetectedLocales: Array<string | null>;
  sourceLanguageLeakageDetected: boolean | null;
  crossEntryOwnershipPassed: boolean | null;
  renderDutyProjectionUsed: boolean | null;
  renderDutyProjectionRevision?: string;
};

export type CvExportStageDiag = {
  stage: CvExportDiagnosticStageName;
  result: CvExportStageResult;
  reason?: string;
};

export type CvExportDiagnosticTrace = {
  schemaVersion: 1;
  capturedAt: string;
  appVersionCode: string | null;
  appVersionName: string | null;
  nextBuildId: string | null;
  selectedTemplateId: string;
  requestedLocale: string;
  exportFormat: CvExportFormat;
  runtimeMigrationVersion: number | null;
  experienceCount: number;
  experiences: CvExportExperienceDiag[];
  summaryPresent: boolean;
  summaryLength: number;
  summaryHash: string;
  summaryOrigin?: string;
  summaryGeneratedLocale?: string;
  contentLocale?: string;
  summaryFactSetSource?: string;
  summarySemanticFactKeys: string[];
  summaryRecoverySource?: string;
  summaryWordCountBefore?: number;
  summaryWordCountAfter?: number;
  summaryWordBudgetMax?: number;
  rawRecoveryWordCount?: number | null;
  rawRecoveryWordBudgetPassed?: boolean | null;
  compactionAttempted?: boolean | null;
  compactedRecoveryWordCount?: number | null;
  selectedFinalWordCount?: number | null;
  selectedFinalWordBudgetPassed?: boolean | null;
  summaryWordBudgetCompactionRevision?: string;
  summaryCurrentTextAuthorityRevision?: string;
  summaryStaleMetadataDetected?: boolean;
  summaryVisibleTextAuthorityRebound?: boolean;
  summaryVisibleTextAuthorityReason?: string;
  summaryVisibleTextAuthorityBlockedReason?: string;
  summaryVisibleTextValidationReason?: string;
  summaryForeignProfessionalPrefixRejected?: boolean;
  summaryStaleReboundLocaleGuardRevision?: string;
  /** V2 entry-owned Summary authority for generated/repaired/fallback output. */
  summarySelectedEntryHashes?: string[];
  summaryOmittedEntryHashes?: string[];
  summaryRequiredFactHashes?: Array<{ owningEntryHash: string; factHash: string }>;
  summaryValidationAuthoritySource?: string;
  summarySavedProvenance?: string;
  summarySavedSummaryReboundRevalidated?: boolean;
  savedSummaryHash?: string;
  savedSummaryOwnershipPassed?: boolean | null;
  savedSummaryOwnershipFailureReasons?: string[];
  savedSummaryJobContextPassed?: boolean | null;
  recoveryCandidateHash?: string;
  recoveryCandidateLocaleValidationPassed?: boolean | null;
  recoveryCandidateNativeSurfacePassed?: boolean | null;
  recoveryCandidateOwnershipPassed?: boolean | null;
  recoveryCandidateRejectionReasons?: string[];
  recoveryDetectedLocaleByUnit?: Array<string | null>;
  recoveryDetectedScriptByUnit?: string[];
  recoveryFactPresentation?: Array<{
    owningEntryHash: string;
    factIdHash: string;
    immutableAuthorityHash: string;
    presentationSurfaceHash: string | null;
    presentationSurfaceAuthority: string;
    detectedTargetLocale: string | null;
    detectedTargetScript: string | null;
  }>;
  selectedFinalSummaryHash?: string;
  selectedFinalSource?: string | null;
  /** Actual Summary value committed to the Preview template data prop. */
  previewRenderedSummaryHash?: string | null;
  previewRenderAuthority?: 'selected_final' | 'manual_saved' | 'unresolved' | 'render_mismatch' | null;
  /** A selected-final Preview witness must equal this export's selected final. */
  previewSelectedFinalParityPassed?: boolean | null;
  previewSnapshotId?: string | null;
  previewSourceSummaryHash?: string | null;
  previewInputSummaryHash?: string | null;
  templatePreviewSummaryHash?: string | null;
  templateLeafSummaryHash?: string | null;
  /** Legacy predicted field; null when no renderer witness exists. */
  visiblePreviewSummaryHash?: string | null;
  exportSummaryHash?: string | null;
  summaryRelationalOwnershipPassed?: boolean | null;
  summaryRelationalOwnershipFailureReasons?: string[];
  summaryFinalUnitOwnership?: Array<{
    unitHash: string;
    roleSlot: string;
    owningEntryHash: string | null;
    roleTitleOwnerEntryHash: string | null;
    employerOwnerEntryHash: string | null;
    dateStatusOwnerEntryHash: string | null;
    dutyFactOwnerEntryHashes: string[];
    relationalOwnershipPassed: boolean;
    relationalOwnershipFailureReasons: string[];
  }>;
  stages: CvExportStageDiag[];
  initialValidationReason?: string;
  deterministicRecoveryReason?: string;
  /** Reason before any page-level remapping (e.g. modern_minimal_stale_snapshot). */
  originalFailureReason?: string;
  finalTypedFailureReason?: string;
  toastMappingKey?: CvExportToastMappingKey;
  toastMessageLocale?: string;
  rendererReached: boolean;
  blobProduced: boolean;
  blobSize: number | null;
  blobMimeType: string | null;
  androidSaveReached: boolean;
  saveResult: SaveFileResult['result'] | null;
  exportReadySnapshotId: string;
  /** Exact target-aware Experience terminal snapshot shared by Preview/PDF/DOCX when prepared. */
  experiencePresentationSnapshotId?: string;
  /** Source-bound Experience localization metadata only; contains no CV prose or raw entry IDs. */
  experienceLocalization?: ExperienceLocalizationDiagnostics & { usageDelta: 0 };
  ok: boolean;
  /** Non-PII success metadata when available. */
  pdfTextLayerType?: 'direct_unicode' | 'shaped_png_hybrid' | 'shaped_png_only' | 'unknown';
  extractedTextLength?: number;
  extractedScriptClasses?: string[];
  pdfHasToUnicode?: boolean;
  durationMonths?: number;
  durationDisplayBucket?: string;
};

const STORAGE_KEY_PDF = 'cvpro-export-diag-pdf';
const STORAGE_KEY_DOCX = 'cvpro-export-diag-docx';

export const CV_EXPORT_LATEST_DIAGNOSTIC_REVISION =
  'cv-export-latest-diagnostic-410-v1' as const;

function storedCvExportDiagnosticCapturedAt(
  format: CvExportFormat,
): number {
  if (typeof window === 'undefined') {
    return Number.NEGATIVE_INFINITY;
  }

  const key = format === 'pdf'
    ? STORAGE_KEY_PDF
    : STORAGE_KEY_DOCX;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return Number.NEGATIVE_INFINITY;

    const parsed = JSON.parse(raw) as { capturedAt?: unknown };
    if (typeof parsed.capturedAt !== 'string') {
      return Number.NEGATIVE_INFINITY;
    }

    const timestamp = Date.parse(parsed.capturedAt);
    return Number.isFinite(timestamp)
      ? timestamp
      : Number.NEGATIVE_INFINITY;
  } catch {
    return Number.NEGATIVE_INFINITY;
  }
}

export function resolveLatestCvExportDiagnosticFormat():
  CvExportFormat | null {
  const pdfAt = storedCvExportDiagnosticCapturedAt('pdf');
  const docxAt = storedCvExportDiagnosticCapturedAt('docx');

  if (
    pdfAt === Number.NEGATIVE_INFINITY
    && docxAt === Number.NEGATIVE_INFINITY
  ) {
    return null;
  }

  return docxAt >= pdfAt ? 'docx' : 'pdf';
}

export async function copyLatestCvExportDiagnosticsToClipboard():
  Promise<boolean> {
  const format = resolveLatestCvExportDiagnosticFormat();
  if (!format) return false;

  return copyCvExportDiagnosticsToClipboard(format);
}

let latestPdf: CvExportDiagnosticTrace | null = null;
let latestDocx: CvExportDiagnosticTrace | null = null;

/** Stable one-way fingerprint — never reversible to original text. */
export function fingerprintText(value: string | undefined | null): string {
  const text = (value || '').normalize('NFKC');
  if (!text) return 'empty';
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const len = text.length;
  const first = text.charCodeAt(0);
  const last = text.charCodeAt(len - 1);
  return `fnv1a_${(h >>> 0).toString(16)}_l${len}_b${first}_e${last}`;
}

export function classifyBulletScript(
  bullet: string,
  targetLocale?: Locale | number,
): string {
  // This function is also passed directly to Array#map by older callers;
  // ignore its numeric index argument rather than treating it as a locale.
  const localeAware = typeof targetLocale === 'string';
  const t = (bullet || '').trim();
  if (!t) return 'empty';
  const dev = (t.match(/[\u0900-\u097F]/g) || []).length;
  const arabic = (t.match(/[\u0600-\u06FF]/g) || []).length;
  const cyrillic = (t.match(/[\u0400-\u04FF]/g) || []).length;
  const cjk = (t.match(/[\u3040-\u30FF\u3400-\u9FFF]/g) || []).length;
  const latin = (t.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  const families = [dev, arabic, cyrillic, cjk, latin].filter((count) => count > 0);
  if (families.length > 1) return 'mixed';
  // Keep the legacy standalone classifier values for older callers, while
  // export diagnostics always pass the requested locale and therefore report
  // an actual script family rather than calling all Latin text English.
  if (dev > 0) return localeAware ? 'devanagari' : 'hi';
  if (arabic > 0) return 'arabic';
  if (cyrillic > 0) return 'cyrillic';
  if (cjk > 0) return 'cjk';
  if (latin > 0) return localeAware ? 'latin' : 'en';
  return 'empty';
}

export function resolveCvExportToastMappingKey(
  reason: string,
  kind: CvExportFormat,
): CvExportToastMappingKey {
  if (/mixed_language_summary|mixed_locale_summary|unlocalized_skill_labels|wrong_language(?:_summary)?|summary:\s*English canonical dump blocked/i.test(reason)) {
    return 'SUMMARY_REGENERATE';
  }
  if (/summary_title_localization_conflict|forced-conflicting-title|invalid_occupational_title|duty_family_mismatch/i.test(reason)) {
    return 'TITLE_CONFLICT';
  }
  if (/preview_render_mismatch|legacy_export_recovery_not_invoked|legacy_export_recovery_snapshot_overwritten|legacy_recovered_snapshot_overwritten|modern_minimal_stale_snapshot|modern_minimal_used_stale_snapshot|localized_display_projection_incomplete/i.test(reason)) {
    return 'LEGACY_SNAPSHOT_REVIEW';
  }
  if (/legacy_export_recovery_no_safe_duties|legacy_grounding_source_missing|legacy_grounding_recovery_failed|legacy_grounding_recovery_empty|semantic_duty_fact_set_empty|legacy_user_origin_recovery_|experience_localization_/i.test(reason)) {
    return 'EXPERIENCE_FACTS_REVIEW';
  }
  if (/summary_grounding_projection_failed|unsupported_summary_fact|summary_proper_noun_rejected|summary_locale_state_mismatch|missing_provenance|migration_failure|recovery_failure|mixed_locale_projection|mixed_locale_field|summary_export_contract_mismatch|summary_recovery_projection_failed|summary_validation_failed_after_recovery|summary_authoritative_fact_set_empty|summary_fact_set_missing_recovered_duties|semantic_duty_fact_set_empty|legacy_grounding_source_missing|legacy_grounding_recovery_failed|legacy_grounding_recovery_empty|legacy_export_recovery_no_safe_duties|legacy_grounding_recovery_not_invoked|legacy_grounding_recovery_overwritten/i.test(reason)) {
    return 'SUMMARY_FACTS_REVIEW';
  }
  if (/legacy_runtime_snapshot_not_applied|legacy_runtime_snapshot_invalid|export_snapshot_stale|showAddress|regionSettings|invalid[_ ]?region/i.test(reason)) {
    return 'LEGACY_SNAPSHOT_REVIEW';
  }
  if (/android_file_save_failed|SaveFailedError|File save failed|Native file save|Native SaveFile/i.test(reason)) {
    return 'FILE_SAVE_FAILED';
  }
  if (/pdf_blob_generation_failed|docx_blob_generation_failed|empty Blob|empty blob|DOCX generation produced an empty/i.test(reason)) {
    return kind === 'pdf' ? 'GENERIC_PDF' : 'GENERIC_DOCX';
  }
  return kind === 'pdf' ? 'GENERIC_PDF' : 'GENERIC_DOCX';
}

function mapPrepareStage(stage: string): CvExportDiagnosticStageName {
  switch (stage) {
    case 'normalize_runtime':
    case 'normalize_region':
      return 'migrate_runtime';
    case 'resolve_provenance':
    case 'recover_legacy_grounding':
      return 'recover_legacy_grounding';
    case 'produce_semantic_duties':
      return 'construct_semantic_duties';
    case 'produce_localized_display':
      return 'project_localized_experience';
    case 'construct_summary_fact_set':
      return 'construct_summary_fact_set';
    case 'validate_summary':
      return 'validate_summary';
    case 'recover_summary':
      return 'recover_summary';
    case 'validate_locale_integrity':
      return 'validate_locale_integrity';
    case 'complete':
      return 'prepare_template';
    default:
      return 'prepare_template';
  }
}

function shellCount(text?: string): number {
  return splitExperienceBullets(text || '').filter(Boolean).length;
}

function experienceDiag(
  exp: WorkExperience,
  index: number,
  hasCanonicalSnapshot: boolean,
  groundingSource: string,
  recoveredKeys: string[],
  locale: Locale,
  presentation?: ExperiencePresentationRecord,
): CvExportExperienceDiag {
  const visible = (exp.description || '').trim();
  const generated = (exp.generatedDescription || '').trim();
  const original = (exp.originalUserDescription || '').trim();
  const canonical = (exp.canonicalDescription || '').trim();
  const displayForCount = visible || generated;
  // A final presentation does not exist until the shared terminal snapshot
  // exists. Do not derive final hashes/scripts/counts from raw/editor text on
  // an earlier failure path: that would falsely label foreign source prose as
  // a selected target presentation. Successful prepared exports carry both
  // source and final script evidence directly from that one snapshot.
  const renderDescription = presentation
    ? getExperienceExportRenderDescription(exp, locale)
    : '';
  const renderDutyProjectionUsed = presentation
    ? renderDescription !== String(exp.description || '')
    : null;
  return {
    index,
    hasOriginalUserDescription: Boolean(original),
    hasCanonicalDescription: Boolean(canonical),
    hasCanonicalSnapshot,
    hasGeneratedDescription: Boolean(generated),
    hasDescriptionOrigin: Boolean(exp.descriptionOrigin),
    hasGeneratedLocale: Boolean(exp.generatedLocale),
    hasGroundingRecoverySource: Boolean(exp.groundingRecoverySource),
    originalUserDescriptionLength: original.length,
    canonicalDescriptionLength: canonical.length,
    generatedDescriptionLength: generated.length,
    descriptionLength: visible.length,
    originalUserDescriptionHash: fingerprintText(original),
    canonicalDescriptionHash: fingerprintText(canonical),
    generatedDescriptionHash: fingerprintText(generated),
    descriptionHash: fingerprintText(visible),
    descriptionOrigin: exp.descriptionOrigin,
    generatedLocale: exp.generatedLocale,
    groundingRecoverySource: exp.groundingRecoverySource,
    groundingSource,
    recoveredSemanticDutyKeys: recoveredKeys,
    recoveredDutyCount: recoveredKeys.length,
    visibleLocalizedBulletCount: shellCount(displayForCount),
    canonicalShellCount: shellCount(original || canonical),
    finalProjectedBulletCount: presentation?.finalPresentationBulletCount ?? null,
    sourceBulletScripts: presentation?.sourceBulletScripts || null,
    finalPresentationBulletScripts: presentation?.finalPresentationBulletScripts || null,
    finalBulletScripts: presentation?.finalPresentationBulletScripts || null,
    presentationSnapshotId: presentation?.presentationSnapshotId || null,
    owningEntryHash: presentation?.owningEntryHash || fingerprintText(exp.id),
    currentVisibleDescriptionHash: presentation?.currentVisibleDescriptionHash
      || fingerprintText(visible),
    sourceLocale: presentation?.sourceLocale || null,
    immutableGroundingLocale: presentation?.immutableGroundingLocale || null,
    currentPresentationLocale: presentation?.currentPresentationLocale || null,
    projectionRequired: presentation?.projectionRequired ?? null,
    presentationAuthority: presentation?.presentationAuthority ?? null,
    recoveryAttempted: presentation?.recoveryAttempted ?? null,
    recoveryKind: presentation?.recoveryKind || null,
    presentationRejectionReason: presentation?.rejectionReason || null,
    presentationTargetLocale: presentation?.targetLocale ?? null,
    presentationHash: presentation?.selectedPresentationHash ?? null,
    finalPresentationHash: presentation?.finalPresentationHash ?? null,
    presentationRequiredFactCount: presentation?.requiredFactCount ?? null,
    presentationCoveredFactCount: presentation?.coveredFactCount ?? null,
    presentationMissingFactCount: presentation?.missingFactCount ?? null,
    presentationFactCoveragePassed: presentation?.factCoveragePassed ?? null,
    immutableFactAuthorityHash: presentation?.immutableFactSetHash ?? null,
    finalBulletDetectedLocales: presentation?.detectedLocaleByBullet || [],
    sourceLanguageLeakageDetected: presentation?.sourceLanguageLeakageDetected ?? null,
    crossEntryOwnershipPassed: presentation?.crossEntryOwnershipPassed ?? null,
    renderDutyProjectionUsed,
    renderDutyProjectionRevision: renderDutyProjectionUsed
      ? CV_EXPORT_RENDER_DUTY_PROJECTION_REVISION
      : undefined,
  };
}

export function buildExportReadySnapshotId(parts: {
  templateId: string;
  locale: string;
  runtimeMigrationVersion: number | null;
  experienceCount: number;
  summaryHash: string;
  dutyKeys: string[];
}): string {
  return fingerprintText([
    parts.templateId,
    parts.locale,
    String(parts.runtimeMigrationVersion ?? ''),
    String(parts.experienceCount),
    parts.summaryHash,
    parts.dutyKeys.join(','),
  ].join('|'));
}

export async function resolveAppVersionInfo(): Promise<{
  versionCode: string | null;
  versionName: string | null;
}> {
  try {
    const { App } = await import('@capacitor/app');
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return { versionCode: null, versionName: null };
    }
    const info = await App.getInfo();
    return {
      versionCode: info.build != null ? String(info.build) : null,
      versionName: info.version || null,
    };
  } catch {
    return { versionCode: null, versionName: null };
  }
}

export function resolveNextBuildId(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    for (const script of Array.from(document.scripts)) {
      const src = script.src || '';
      const m = src.match(/\/_next\/static\/([^/]+)\//);
      if (m?.[1] && !['chunks', 'css', 'media'].includes(m[1])) return m[1];
    }
    for (const link of Array.from(document.querySelectorAll('link[href*="/_next/static/"]'))) {
      const href = (link as HTMLLinkElement).href || '';
      const m = href.match(/\/_next\/static\/([^/]+)\//);
      if (m?.[1] && !['chunks', 'css', 'media'].includes(m[1])) return m[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persist(trace: CvExportDiagnosticTrace): void {
  if (trace.exportFormat === 'pdf') latestPdf = trace;
  else latestDocx = trace;
  if (typeof localStorage === 'undefined') return;
  try {
    const key = trace.exportFormat === 'pdf' ? STORAGE_KEY_PDF : STORAGE_KEY_DOCX;
    localStorage.setItem(key, JSON.stringify(trace));
  } catch {
    /* quota — keep in-memory only */
  }
}

export function getLatestCvExportDiagnostic(format?: CvExportFormat): CvExportDiagnosticTrace | null {
  if (format === 'pdf') return latestPdf || readStored('pdf');
  if (format === 'docx') return latestDocx || readStored('docx');
  return latestPdf || latestDocx || readStored('pdf') || readStored('docx');
}

function readStored(format: CvExportFormat): CvExportDiagnosticTrace | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(format === 'pdf' ? STORAGE_KEY_PDF : STORAGE_KEY_DOCX);
    if (!raw) return null;
    return JSON.parse(raw) as CvExportDiagnosticTrace;
  } catch {
    return null;
  }
}

export function formatCvExportDiagnosticForCopy(trace: CvExportDiagnosticTrace): string {
  return `${JSON.stringify(trace, null, 2)}\n`;
}

/** Assert a diagnostic payload never includes raw CV prose / PII field names with values. */
export function assertDiagnosticHasNoCvText(trace: CvExportDiagnosticTrace): string[] {
  const json = JSON.stringify(trace);
  const violations: string[] = [];
  // Reject long Devanagari/Latin prose blobs (hashes are short tokens).
  if (/[\u0900-\u097F]{12,}/.test(json)) violations.push('devanagari_prose');
  if (/"fullName"|"email"|"phone"|"company"|Ztrew|ivan@example/i.test(json)) violations.push('pii_field');
  if (/\bPrepare dishes according to restaurant standards\b/i.test(json)) violations.push('english_shell_text');
  return violations;
}

export async function copyCvExportDiagnosticsToClipboard(
  format?: CvExportFormat,
): Promise<boolean> {
  const trace = getLatestCvExportDiagnostic(format);
  if (!trace) return false;
  const text = formatCvExportDiagnosticForCopy(trace);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export type BuildCvExportTraceInput = {
  format: CvExportFormat;
  locale: Locale;
  rawCv: CVData;
  prepared: PrepareExportReadyResult | null;
  /** Reason before page remapping, when different from final. */
  originalFailureReason?: string;
  finalError?: unknown;
  rendererReached?: boolean;
  blobProduced?: boolean;
  blobSize?: number | null;
  blobMimeType?: string | null;
  androidSaveReached?: boolean;
  saveResult?: SaveFileResult | null;
  appVersionCode?: string | null;
  appVersionName?: string | null;
  nextBuildId?: string | null;
  experienceLocalization?: ExperienceLocalizationDiagnostics | null;
  previewSummaryRender?: {
    previewRenderedSummaryHash: string;
    previewRenderAuthority: 'selected_final' | 'manual_saved' | 'unresolved' | 'render_mismatch';
    selectedFinalSummaryHash: string | null;
    previewSnapshotId?: string;
    previewSourceSummaryHash?: string;
    previewInputSummaryHash?: string;
    templatePreviewSummaryHash?: string;
    templateLeafSummaryHash?: string | null;
    previewSelectedFinalParityPassed?: boolean | null;
  } | null;
  extraStages?: CvExportStageDiag[];
  /** Optional non-PII PDF text-layer metrics from the export caller. */
  pdfTextLayerType?: CvExportDiagnosticTrace['pdfTextLayerType'];
  extractedTextLength?: number;
  extractedScriptClasses?: BulletScriptClass[];
  pdfHasToUnicode?: boolean;
};

/**
 * Build and store the latest PDF or DOCX diagnostic from the live export path.
 * Does not mutate the CV.
 */
export function buildAndStoreCvExportDiagnostic(input: BuildCvExportTraceInput): CvExportDiagnosticTrace {
  const raw = input.rawCv;
  const prepared = input.prepared;
  const diag: ExportReadyDiagnostics | null = prepared
    ? (prepared.ok ? prepared.diagnostics : prepared.diagnostics)
    : null;
  const exportCv = prepared && prepared.ok ? prepared.cv : raw;

  const dutyKeys = diag?.summarySemanticDutyKeys || [];
  const summaryText = (exportCv.summary || '').trim();
  const summaryHash = fingerprintText(summaryText);

  const experiences = (exportCv.experience || []).map((exp, index) => {
    const row = diag?.experienceProvenance?.[index];
    const keys = row?.semanticDutyKeys
      || (exp.recoveredSemanticDuties || []).map((d) => d.key)
      || [];
    return experienceDiag(
      exp,
      index,
      Boolean(exportCv.canonicalSnapshot) || Boolean(row?.hasCanonicalSnapshot),
      row?.source || (exp.groundingRecoverySource || 'unknown'),
      keys,
      input.locale,
      diag?.experiencePresentation?.[index],
    );
  });

  const stages: CvExportStageDiag[] = [
    { stage: 'load_draft', result: 'ok' },
    { stage: 'migrate_runtime', result: 'ok' },
    { stage: 'construct_raw_export_snapshot', result: 'ok' },
  ];

  const localization = input.experienceLocalization || null;
  if (localization) {
    const failStage = localization.failureStage;
    const localizationStages: Array<{
      diagnosticStage: CvExportDiagnosticStageName;
      operationStage: string;
      skipped?: boolean;
    }> = [
      {
        diagnosticStage: 'resolve_experience_source_locale',
        operationStage: 'resolve_source_locale',
      },
      {
        diagnosticStage: 'lookup_localized_experience_surfaces',
        operationStage: 'lookup_localized_surfaces',
      },
      {
        diagnosticStage: 'acquire_localized_experience_surfaces',
        operationStage: 'acquire_localized_surfaces',
        skipped: localization.providerRequestCount === 0,
      },
      {
        diagnosticStage: 'validate_localized_experience_surfaces',
        operationStage: 'validate_localized_surfaces',
        skipped: localization.providerRequestCount === 0,
      },
      {
        diagnosticStage: 'revalidate_experience_export_snapshot',
        operationStage: 'revalidate_export_snapshot',
        skipped: localization.providerRequestCount === 0,
      },
      {
        diagnosticStage: 'persist_localized_experience_surfaces',
        operationStage: 'persist_localized_surfaces',
        skipped: localization.providerRequestCount === 0,
      },
    ];
    let localizationFailed = false;
    for (const item of localizationStages) {
      if (localizationFailed) {
        stages.push({ stage: item.diagnosticStage, result: 'skipped' });
        continue;
      }
      if (failStage === item.operationStage) {
        stages.push({
          stage: item.diagnosticStage,
          result: 'fail',
          reason: localization.failureReason,
        });
        localizationFailed = true;
        continue;
      }
      stages.push({
        stage: item.diagnosticStage,
        result: item.skipped ? 'skipped' : 'ok',
      });
    }
  }

  if (diag) {
    const failStage = prepared && !prepared.ok ? mapPrepareStage(prepared.stage) : null;
    const ordered: CvExportDiagnosticStageName[] = [
      'recover_legacy_grounding',
      'construct_semantic_duties',
      'project_localized_experience',
      'construct_summary_fact_set',
      'validate_summary',
      'recover_summary',
      'validate_locale_integrity',
      'prepare_template',
    ];
    for (const name of ordered) {
      if (failStage && name === failStage) {
        stages.push({
          stage: name,
          result: 'fail',
          reason: prepared && !prepared.ok ? prepared.reason : undefined,
        });
        break;
      }
      if (failStage && ordered.indexOf(name) > ordered.indexOf(failStage)) {
        stages.push({ stage: name, result: 'skipped' });
        continue;
      }
      // Never mark validate_summary ok when initial validation failed (e.g. mixed_locale_summary).
      if (name === 'validate_summary' && diag.summaryInitialValid === false) {
        stages.push({
          stage: name,
          result: 'fail',
          reason: diag.summaryInitialReason || 'summary_initial_validation_failed',
        });
        continue;
      }
      // recover_summary only when recovery ran
      if (
        name === 'recover_summary'
        && diag.summaryRecoverySource === 'saved_summary'
        && diag.summaryInitialValid !== false
      ) {
        stages.push({ stage: name, result: 'skipped' });
        continue;
      }
      if (
        name === 'recover_summary'
        && diag.summaryInitialValid === false
        && diag.summaryRecoverySource === 'deterministic_semantic_facts'
        && prepared?.ok
      ) {
        stages.push({ stage: name, result: 'ok' });
        continue;
      }
      stages.push({ stage: name, result: 'ok' });
    }
    if (prepared?.ok) {
      // ensure prepare_template marked ok
      if (!stages.some((s) => s.stage === 'prepare_template' && s.result === 'ok')) {
        stages.push({ stage: 'prepare_template', result: 'ok' });
      }
    }
  } else if (localization?.failureReason) {
    stages.push({ stage: 'recover_legacy_grounding', result: 'skipped' });
  } else {
    stages.push({ stage: 'recover_legacy_grounding', result: 'fail', reason: 'prepare_not_invoked' });
  }

  for (const extra of input.extraStages || []) stages.push(extra);

  const finalReason = input.finalError
    ? extractCvExportFailureReason(input.finalError)
    : (prepared && !prepared.ok ? prepared.reason : undefined);

  const toastKey = finalReason
    ? resolveCvExportToastMappingKey(finalReason, input.format)
    : undefined;

  const snapshotId = buildExportReadySnapshotId({
    templateId: String(raw.templateId || ''),
    locale: input.locale,
    runtimeMigrationVersion: Number(exportCv.runtimeMigrationVersion ?? raw.runtimeMigrationVersion ?? null) || null,
    experienceCount: (exportCv.experience || []).length,
    summaryHash,
    dutyKeys,
  });

  const previewSelectedFinalParityPassed = input.previewSummaryRender?.previewSelectedFinalParityPassed === false
    ? false
    : input.previewSummaryRender?.previewRenderAuthority === 'selected_final'
      ? input.previewSummaryRender.previewRenderedSummaryHash === diag?.selectedFinalSummaryHash
        && input.previewSummaryRender.selectedFinalSummaryHash === diag?.selectedFinalSummaryHash
      : null;
  const ok = Boolean(prepared?.ok)
    && !finalReason
    && previewSelectedFinalParityPassed !== false
    && (input.saveResult?.result === 'saved' || input.blobProduced === true);

  const durationSnap = buildExperienceDurationSnapshot(
    exportCv.experience || [],
    new Date(),
  );

  const trace: CvExportDiagnosticTrace = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    appVersionCode: input.appVersionCode ?? null,
    appVersionName: input.appVersionName ?? null,
    nextBuildId: input.nextBuildId ?? resolveNextBuildId(),
    selectedTemplateId: String(diag?.selectedTemplateId || raw.templateId || ''),
    requestedLocale: input.locale,
    exportFormat: input.format,
    runtimeMigrationVersion: Number(exportCv.runtimeMigrationVersion ?? raw.runtimeMigrationVersion ?? null) || null,
    experienceCount: (exportCv.experience || []).length,
    experiences,
    summaryPresent: Boolean(summaryText),
    summaryLength: summaryText.length,
    summaryHash,
    summaryOrigin: exportCv.summaryOrigin,
    summaryGeneratedLocale: exportCv.summaryGeneratedLocale,
    contentLocale: exportCv.contentLocale,
    summaryFactSetSource: diag?.summaryFactSetSource,
    summarySemanticFactKeys: dutyKeys,
    summaryRecoverySource: diag?.summaryRecoverySource,
    summaryWordCountBefore: diag?.summaryWordCountBefore,
    summaryWordCountAfter: diag?.summaryWordCountAfter,
    summaryWordBudgetMax: diag?.summaryWordBudgetMax,
    rawRecoveryWordCount: diag?.rawRecoveryWordCount,
    rawRecoveryWordBudgetPassed: diag?.rawRecoveryWordBudgetPassed,
    compactionAttempted: diag?.compactionAttempted,
    compactedRecoveryWordCount: diag?.compactedRecoveryWordCount,
    selectedFinalWordCount: diag?.selectedFinalWordCount,
    selectedFinalWordBudgetPassed: diag?.selectedFinalWordBudgetPassed,
    summaryWordBudgetCompactionRevision: diag?.summaryWordBudgetCompactionRevision,
    summaryCurrentTextAuthorityRevision: diag?.summaryCurrentTextAuthorityRevision,
    summaryStaleMetadataDetected: diag?.summaryStaleMetadataDetected,
    summaryVisibleTextAuthorityRebound: diag?.summaryVisibleTextAuthorityRebound,
    summaryVisibleTextAuthorityReason:
      diag?.summaryVisibleTextAuthorityReason,
    summaryVisibleTextAuthorityBlockedReason:
      diag?.summaryVisibleTextAuthorityBlockedReason,
    summaryVisibleTextValidationReason:
      diag?.summaryVisibleTextValidationReason,
    summaryForeignProfessionalPrefixRejected:
      diag?.summaryForeignProfessionalPrefixRejected,
    summaryStaleReboundLocaleGuardRevision:
      diag?.summaryStaleReboundLocaleGuardRevision,
    summarySelectedEntryHashes: diag?.summarySelectedEntryHashes,
    summaryOmittedEntryHashes: diag?.summaryOmittedEntryHashes,
    summaryRequiredFactHashes: diag?.summaryRequiredFactHashes,
    summaryValidationAuthoritySource: diag?.summaryValidationAuthoritySource,
    summarySavedProvenance: diag?.summarySavedProvenance,
    summarySavedSummaryReboundRevalidated:
      diag?.summarySavedSummaryReboundRevalidated,
    savedSummaryHash: diag?.savedSummaryHash,
    savedSummaryOwnershipPassed: diag?.savedSummaryOwnershipPassed,
    savedSummaryOwnershipFailureReasons: diag?.savedSummaryOwnershipFailureReasons,
    savedSummaryJobContextPassed: diag?.savedSummaryJobContextPassed,
    recoveryCandidateHash: diag?.recoveryCandidateHash,
    recoveryCandidateLocaleValidationPassed: diag?.recoveryCandidateLocaleValidationPassed,
    recoveryCandidateNativeSurfacePassed: diag?.recoveryCandidateNativeSurfacePassed,
    recoveryCandidateOwnershipPassed: diag?.recoveryCandidateOwnershipPassed,
    recoveryCandidateRejectionReasons: diag?.recoveryCandidateRejectionReasons,
    recoveryDetectedLocaleByUnit: diag?.recoveryDetectedLocaleByUnit,
    recoveryDetectedScriptByUnit: diag?.recoveryDetectedScriptByUnit,
    recoveryFactPresentation: diag?.recoveryFactPresentation,
    selectedFinalSummaryHash: diag?.selectedFinalSummaryHash,
    selectedFinalSource: diag?.selectedFinalSource,
    previewRenderedSummaryHash: input.previewSummaryRender?.previewRenderedSummaryHash ?? null,
    previewRenderAuthority: previewSelectedFinalParityPassed === false
      ? 'render_mismatch'
      : input.previewSummaryRender?.previewRenderAuthority ?? null,
    previewSelectedFinalParityPassed,
    previewSnapshotId: input.previewSummaryRender?.previewSnapshotId ?? null,
    previewSourceSummaryHash: input.previewSummaryRender?.previewSourceSummaryHash ?? null,
    previewInputSummaryHash: input.previewSummaryRender?.previewInputSummaryHash ?? null,
    templatePreviewSummaryHash: input.previewSummaryRender?.templatePreviewSummaryHash ?? null,
    templateLeafSummaryHash: input.previewSummaryRender?.templateLeafSummaryHash ?? null,
    // This former exporter-only prediction must never substitute for an
    // actual Preview witness.
    visiblePreviewSummaryHash: input.previewSummaryRender?.previewRenderedSummaryHash ?? null,
    exportSummaryHash: diag?.exportSummaryHash,
    summaryRelationalOwnershipPassed: diag?.summaryRelationalOwnershipPassed,
    summaryRelationalOwnershipFailureReasons:
      diag?.summaryRelationalOwnershipFailureReasons,
    summaryFinalUnitOwnership: diag?.summaryFinalUnitOwnership,
    stages,
    initialValidationReason: diag?.summaryInitialReason,
    deterministicRecoveryReason: diag?.summaryRecoveryReason,
    originalFailureReason: input.originalFailureReason || (prepared && !prepared.ok ? prepared.reason : undefined),
    finalTypedFailureReason: finalReason || undefined,
    toastMappingKey: toastKey,
    toastMessageLocale: input.locale,
    rendererReached: Boolean(input.rendererReached),
    blobProduced: Boolean(input.blobProduced),
    blobSize: input.blobSize ?? null,
    blobMimeType: input.blobMimeType ?? null,
    androidSaveReached: Boolean(input.androidSaveReached),
    saveResult: input.saveResult?.result ?? null,
    exportReadySnapshotId: snapshotId,
    experiencePresentationSnapshotId: diag?.experiencePresentationSnapshotId,
    experienceLocalization: localization
      ? { ...localization, usageDelta: 0 }
      : undefined,
    ok: Boolean(ok && !finalReason),
    pdfTextLayerType: input.pdfTextLayerType,
    extractedTextLength: input.extractedTextLength,
    extractedScriptClasses: input.extractedScriptClasses,
    pdfHasToUnicode: input.pdfHasToUnicode,
    durationMonths: durationSnap.total.hasValidDates ? durationSnap.total.totalMonths : undefined,
    durationDisplayBucket: durationSnap.total.hasValidDates
      ? durationDisplayBucket(durationSnap.total)
      : undefined,
  };

  // If we have a failure reason, force ok=false even when save somehow ran.
  if (finalReason) trace.ok = false;

  persist(trace);
  return trace;
}

/** Localized toast text used for mapping confirmation in the trace payload. */
export function peekToastTextForReason(
  reason: string,
  locale: Locale,
  format: CvExportFormat,
): string {
  return formatCvExportIntegrityToast({ reason }, locale, format);
}

export function clearCvExportDiagnosticsForTests(): void {
  latestPdf = null;
  latestDocx = null;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PDF);
    localStorage.removeItem(STORAGE_KEY_DOCX);
  } catch {
    /* ignore */
  }
}
