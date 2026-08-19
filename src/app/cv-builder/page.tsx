'use client';

import { syncCvRefFromReactState } from '@/lib/cv-summary-cvref-react-sync';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useI18n } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/translations';
import { useApp, checkProAccess } from '@/lib/store';
import {
  beginAiClientRequest,
  finishAiClientRequest,
  precheckAiCircuit,
  resolveAiHttpFailure,
} from '@/lib/ai-client-request';
import { aiErrorMessage, mapExperienceAiFailureToErrorCode } from '@/lib/ai-error-codes';
import {
  hasSufficientSummaryGenerationContext,
  resolveAiButtonOperationMode,
  summaryRewriteButtonId,
} from '@/lib/cv-ai-operation-contract';
import { logAiLocaleTransitionDiagnostics } from '@/lib/ai-usage-policy';
import {
  AI_CLIENT_TIMEOUT_MS,
  EXPERIENCE_LOCALIZATION_CLIENT_TIMEOUT_MS,
  computeExperienceLocalizationOperationDeadline,
  logAiClientRequestTiming,
  resolveClientAbortTimeoutMs,
} from '@/lib/ai-request-timing';
import { templateComponents } from '@/components/cv-templates';
import { analyzeJobDescription } from '@/lib/ai';
import { industryOptions, levelOptions, type BulletIndustry, type BulletLevel } from '@/lib/ai-bullets';
import { exportAtsStandardPdf, exportCleanSimplePdf, exportContemporaryBoldPdf, exportCorporateNavyPdf, exportCreativeArtisticPdf, exportCreativeBoldPdf, exportElegantFormalPdf, exportExecutivePremiumPdf, exportModernMinimalPdf, exportNordicCleanPdf, exportProfessionalClassicPdf, exportRirekishoPdf, exportTechSidebarPdf, exportToClipboard, exportToDOCX, exportRirekishoToDOCX, exportToPDF, openPrintFallback, assertDedicatedPdfRouteWasHandled, readPdfExportTemplateIdFromPreview, recordCvPdfExportRuntimeTrace, resolveCvForPdfExport, resolveCvPdfExportRoute } from '@/lib/export';
import { makeCvExportBaseName } from '@/lib/export-filename';
import { getCvExportSuccessToast, type ExportFileFormat } from '@/lib/export-success-toast';
import {
  CvExportFailure,
  extractCvExportFailureReason,
  formatCvExportIntegrityToast,
  wrapCvExportFailure,
} from '@/lib/cv-export-error-message';
import {
  buildAndStoreCvExportDiagnostic,
  copyCvExportDiagnosticsToClipboard,
  fingerprintText,
  resolveAppVersionInfo,
  resolveNextBuildId,
} from '@/lib/cv-export-diagnostics';
import {
  copyExperienceAiDiagnosticsToClipboard,
  ExperienceAiDiagnosticSession,
  type ExperienceAiDiagnosticTrace,
} from '@/lib/cv-experience-ai-diagnostics';
import { SummaryAiDiagnosticSession, resolveAuthoritativeVisibleSummaryText } from '@/lib/cv-summary-ai-diagnostics';
import { resolveSummaryFinalizeClientOutcome } from '@/lib/cv-summary-noop-ui';
import { INTERNAL_AI_RESET_ENABLED } from '@/lib/build-channel';
import {
  ExperienceAiCopyDiagnosticsButton,
  SummaryAiCopyDiagnosticsButton,
} from '@/components/CvExportDiagnosticsControls';
import type { SaveFileResult } from '@/lib/native-save';
import {
  CV_RUNTIME_MIGRATION_VERSION,
  normalizeLegacyCvRuntime,
} from '@/lib/cv-legacy-runtime-migration';
import {
  filterCvLanguageOptions,
  getLocalizedCvLanguageName,
  resolveStoredCvLanguageName,
  type CvLanguageOption,
} from '@/lib/cv-language-options';
import {
  filterCvSkillOptions,
  getLocalizedCvSkillName,
  resolveStoredCvSkillName,
  getSkillSuggestionsByJobTitle,
  getSkillSuggestionsByJobTitles,
  getSkillSuggestionsByIndustry,
  getSkillCategory,
  type CvSkillOption,
} from '@/lib/cv-skill-options';
import { createEmptyCv } from '@/lib/cv-defaults';
import type { CVData, WorkExperience, Education, Region, TemplateId } from '@/lib/types';
import { templateInfo, recommendTemplate } from '@/lib/types';
import {
  ensureCanonicalExperienceFrozen,
  ensureExperienceAiSourceFrozen,
  freezeExperienceAiDescription,
} from '@/lib/cv-canonical-facts';
import {
  applyCanonicalExperienceEdit,
  applyCanonicalSkillsLanguagesEducationEdit,
  applyCanonicalSummaryEdit,
} from '@/lib/cv-canonical-snapshot';
import { buildExperienceDurationSnapshot, durationToPromptToken } from '@/lib/cv-experience-duration';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import {
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildSummaryV2ManifestForCv,
  buildSummaryV2ProviderExperienceEntries,
  summaryV2SnapshotMatchesCv,
  localizeSummaryV2Manifest,
  resolveSummaryCurrentRole,
  type SummaryV2LocalizationOutcome,
  type SummaryV2LocalizationProviderResponse,
  type SummaryV2LocalizationTransportInput,
  type SummaryV2SelectionManifest,
} from '@/lib/cv-summary-v2';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import {
  SUMMARY_TRANSACTIONAL_APPLY_387_REVISION,
  createSummaryApplyOwnershipState,
  commitSummaryApplyTransactionally,
  rollbackSummaryApplyTransactionally,
  shouldAcceptIncomingSummaryCv,
  shouldFlushSummaryAutosave,
  hashSummaryTextForApply,
  classifySummaryVisibleApplyFailure,
} from '@/lib/cv-summary-transactional-apply';
import {
  EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION,
  EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION,
  validateVisibleExperienceCoverage,
} from '@/lib/cv-experience-phased-apply-329';
import {
  EXPERIENCE_TRANSACTION_OWNERSHIP_414_REVISION,
  createExperienceApplyOwnershipState,
  commitExperienceApplyTransactionally,
  rollbackExperienceApplyTransactionally,
  releaseExperienceApplyOwnership,
  shouldAcceptIncomingExperienceCv,
} from '@/lib/cv-experience-transactional-apply';
import {
  canonicalizeContentLocale,
  resolveCommittedAppliedVisibleContentLocale,
} from '@/lib/cv-content-locale';
import {
  buildExperienceJobContext,
  experienceJobContextsMatch,
  resolveExperienceAiGrounding,
  candidateConflictsWithJobContext,
  type ExperienceAiJobContextTrace,
} from '@/lib/cv-experience-job-context';
import {
  resolveExperienceAiAuthoritativeSource,
} from '@/lib/cv-experience-provenance';
import {
  resolveExperienceTextareaProvenance,
  resolveTrustedUneditedAiOutputLocale,
  EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
} from '@/lib/cv-experience-ai-output-provenance';
void EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
import {
  createExperienceAiOperationSnapshot,
  applyOperationSnapshotToExperience,
} from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceOperationSourceBundle,
  evaluateUneditedRerunEarlyNoOpPreflight,
  resolveExperienceFactAuthorityText,
  EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION,
} from '@/lib/cv-experience-operation-source-bundle';
import { analyzeExperienceVisibleSource } from '@/lib/cv-experience-visible-source-analysis';
import { buildExperienceRequestTimeCleanNoOpSnapshot } from '@/lib/cv-experience-terminal-outcome';
void EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION;
import {
  buildExperienceAiNoOpRepairPrompt,
  isRecoverableExperienceProviderNoOp,
} from '@/lib/cv-experience-ai-noop-recovery';
import {
  localizeCvLanguageLevel,
  normalizeCvLanguagesProficiency,
  normalizeLanguageProficiencyToCanonical,
} from '@/lib/cv-language-levels';
import {
  omitInvalidLocalizedFieldsForPreview,
} from '@/lib/cv-field-locale-integrity';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { prepareCorporateNavyExport } from '@/lib/corporate-navy-export-integrity';
import {
  buildPreviewSummarySnapshotId,
  commitPreviewSummaryLeafEvidence,
  describePreviewSummaryRender,
  prepareExportReadyCv,
  sameSnapshotPreviewParityFailure,
  type PrepareExportReadyResult,
  type PreviewSummaryRenderEvidence,
} from '@/lib/prepare-export-ready-cv';
import {
  resolveCvExportSourceAuthority,
} from '@/lib/cv-export-source-authority';
import {
  buildPersistableCvAfterExportPreparation,
  exportDraftVisibleContentPreserved,
  CV_EXPORT_DRAFT_ISOLATION_REVISION,
} from '@/lib/cv-export-draft-isolation';
import {
  prepareExportLocalizedTitles,
  CV_EXPORT_TITLE_LOCALIZATION_REVISION,
  type ExportTitleLocalizationTransportInput,
} from '@/lib/cv-export-title-localization';
void CV_EXPORT_DRAFT_ISOLATION_REVISION;
void CV_EXPORT_TITLE_LOCALIZATION_REVISION;
import { loadCvDraft } from '@/lib/draft-storage';
import { terminalizeAiDiagnosticSession } from '@/lib/cv-ai-diagnostics-terminalize';
import {
  EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS,
  applyTerminalExperiencePresentationSnapshot,
  buildExperienceLocalizationSnapshot,
  experienceDescriptionLocalizationLimitViolation,
  isTerminalExperiencePresentationReady,
  prepareExperienceLocalizedSurfaces,
  resolveExperiencePresentationSnapshot,
  type ExperienceLocalizationProviderResponse,
  type ExperienceLocalizationRequest,
  type ExperienceLocalizationDiagnostics,
} from '@/lib/cv-experience-localized-surfaces';
import { apiFetch } from '@/lib/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles, Plus, Trash2, Eye, FileText, Copy,
  Search, ChevronLeft, ChevronRight, Wand2, Crown, Star, Lock,
  Download, ChevronDown, File, Maximize2
} from 'lucide-react';
import { PhotoUpload } from '@/components/PhotoUpload';
import { MonthPicker } from '@/components/MonthPicker';
import { UpgradeBuilderBanner, FreeLimitModal, JobAnalyzerProModal, AiImprovementsProModal, SummaryAiProModal, ProTemplateModal, AiRecommendProModal } from '@/components/UpgradePro';
import { PremiumAIButton, ProBadge } from '@/components/PremiumAIButton';
import { JobAnalysisResultScreen, JobAnalysisLoadingState } from '@/components/JobAnalysisResultScreen';
import { TemplatePreview } from '@/components/TemplatePreview';
import { CvExportCopyDiagnosticsButton } from '@/components/CvExportDiagnosticsControls';
import { TemplatePreviewFullscreenModal } from '@/components/TemplatePreviewFullscreenModal';
import {
  createElegantFormalPortraitPhoto,
  isCleanElegantFormalPortraitPhoto,
  prepareElegantFormalCanonicalPhoto,
  type ElegantFormalCanonicalPhotoResult,
} from '@/lib/elegant-formal-photo';

const emptyCV = createEmptyCv;

/** Keep recovery diagnostics typed and privacy-safe; never serialize server prose. */
function normalizeRecoveryRejectionReason(
  data: { code?: unknown; error?: unknown } | null | undefined,
  response: { ok: boolean; status: number },
): string {
  const code = typeof data?.code === 'string' ? data.code.trim() : '';
  if (/^[a-z][a-z0-9_]{2,63}$/u.test(code)) return code;
  if (!response.ok) {
    if (response.status === 422) return 'recovery_validation_failed';
    if (response.status >= 400 && response.status <= 599) return `recovery_http_${response.status}`;
  }
  return response.ok ? 'recovery_empty_candidate' : 'recovery_request_failed';
}

function recoveryCandidateMetadata(text: string): {
  recoveryCandidateHash: string | null;
  recoveryCandidateUnitCount: number;
  recoveryCandidateUnitHashes: string[];
} {
  const units = text
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:[•*-]|\d+[.)])\s*/u, '').replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  return {
    recoveryCandidateHash: text.trim()
      ? fingerprintText(text.replace(/\s+/gu, ' ').trim())
      : null,
    recoveryCandidateUnitCount: units.length,
    recoveryCandidateUnitHashes: units.map((unit) => fingerprintText(unit)),
  };
}

const emptyExp = (): WorkExperience => ({
  id: crypto.randomUUID(),
  company: '',
  position: '',
  startDate: '',
  endDate: '',
  isPresent: false,
  description: '',
  canonicalDescription: '',
});

const emptyEdu = (): Education => ({
  id: crypto.randomUUID(), school: '', degree: '', startDate: '', endDate: '', description: '',
});

const RECT_PHOTO_TEMPLATES: TemplateId[] = ['elegant-formal', 'executive-premium'];

const EXPERIENCE_LOCALIZATION_LIMIT_MESSAGE: Record<Locale, string> = {
  en: 'A duty exceeds the AI localization limit. Your full text remains saved and can still be exported in its current language.',
  de: 'Eine Aufgabe überschreitet das Limit für die KI-Lokalisierung. Der vollständige Text bleibt gespeichert und kann weiterhin in der aktuellen Sprache exportiert werden.',
  es: 'Una función supera el límite de localización con IA. El texto completo seguirá guardado y podrá exportarse en su idioma actual.',
  fr: 'Une mission dépasse la limite de localisation par IA. Le texte complet reste enregistré et peut toujours être exporté dans sa langue actuelle.',
  it: 'Una mansione supera il limite di localizzazione IA. Il testo completo resta salvato e può comunque essere esportato nella lingua attuale.',
  ar: 'تتجاوز إحدى المهام حد الترجمة بالذكاء الاصطناعي. سيظل النص الكامل محفوظًا ويمكن تصديره بلغته الحالية.',
  sr: 'Jedna dužnost prelazi limit za AI lokalizaciju. Ceo tekst ostaje sačuvan i može se izvesti na trenutnom jeziku.',
  hr: 'Jedna dužnost prelazi ograničenje za AI lokalizaciju. Cijeli tekst ostaje spremljen i može se izvesti na trenutačnom jeziku.',
  ru: 'Одна из обязанностей превышает лимит ИИ-локализации. Полный текст останется сохранённым и может быть экспортирован на текущем языке.',
  'pt-BR': 'Uma atividade excede o limite de localização por IA. O texto completo continuará salvo e poderá ser exportado no idioma atual.',
  hi: 'एक कार्य AI स्थानीयकरण सीमा से अधिक है। पूरा पाठ सुरक्षित रहेगा और वर्तमान भाषा में निर्यात किया जा सकेगा।',
  ja: '職務内容の1項目がAIローカライズ上限を超えています。全文は保存されたままで、現在の言語で引き続き書き出せます。',
};

type PersonalPhotoVariants = {
  originalPhoto?: string;
  rectangularPhoto?: string;
  circularPhoto?: string;
};

function getPersonalPhotoVariants(cvData: CVData): PersonalPhotoVariants {
  const personal = cvData.personal as typeof cvData.personal & PersonalPhotoVariants;
  return {
    originalPhoto: personal.originalPhoto,
    rectangularPhoto: personal.rectangularPhoto,
    circularPhoto: personal.circularPhoto,
  };
}

function describeElegantFormalPhotoField(fieldName: string, value?: string): string {
  if (!value) return `${fieldName}=missing`;
  const mime = value.match(/^data:([^;,]+)/i)?.[1] ?? 'unknown';
  return `${fieldName}=present mime=${mime} length=${value.length}`;
}

function stripPhotoCacheFragment(value?: string): string | undefined {
  return value?.split('#')[0];
}

async function resolveSummaryLocalizedManifest(options: {
  cv: CVData;
  locale: Locale;
  gender: string;
  referenceDateIso: string;
  proToken: string;
  requestId: string;
  signal: AbortSignal;
}): Promise<SummaryV2LocalizationOutcome & {
  sourceManifest: SummaryV2SelectionManifest;
}> {
  const sourceManifest = buildSummaryV2ManifestForCv({
    cv: options.cv,
    locale: options.locale,
    gender: options.gender,
    referenceDateIso: options.referenceDateIso,
  });
  const requestLocalization = async (
    action: 'summary-localize' | 'summary-context-localize',
    request: SummaryV2LocalizationTransportInput,
  ): Promise<SummaryV2LocalizationProviderResponse> => {
    const { data, response, jsonParseFailed } = await apiFetch<{
      localizedManifest?: SummaryV2LocalizationProviderResponse;
      error?: string;
      code?: string;
      localizationTypedFailureReason?: string;
      apiResponseKind?: string;
      serverFallbackUsed?: boolean;
      clientFallbackUsed?: boolean;
    }>('/api/generate', {
      body: {
        action,
        proToken: options.proToken,
        requestId: options.requestId,
        ...request,
      },
      signal: options.signal,
    });
    if (!response.ok || !data?.localizedManifest) {
      throw Object.assign(new Error(
        data?.localizationTypedFailureReason
        || data?.code
        || (jsonParseFailed ? 'provider_invalid_response' : '')
        || data?.error
        || 'localization_provider_failed',
      ), {
        reason: data?.localizationTypedFailureReason || data?.code || 'localization_provider_failed',
        httpStatus: response.status,
        apiResponseKind: data?.apiResponseKind
          || (jsonParseFailed ? 'invalid_json' : 'http_error'),
        serverFallbackUsed: data?.serverFallbackUsed === true,
        clientFallbackUsed: data?.clientFallbackUsed === true,
      });
    }
    return data.localizedManifest;
  };
  const outcome = await localizeSummaryV2Manifest({
    manifest: sourceManifest,
    transport: (request) => requestLocalization('summary-localize', request),
    recoveryTransport: (request) => requestLocalization('summary-context-localize', request),
  });
  return { ...outcome, sourceManifest };
}

type ResolvedSummaryLocalization = Awaited<ReturnType<typeof resolveSummaryLocalizedManifest>>;

function recordSummaryLocalizationDiagnostics(
  session: SummaryAiDiagnosticSession,
  localization: ResolvedSummaryLocalization,
  cv: CVData,
): void {
  const selectedIds = new Set([
    ...(localization.sourceManifest.current ? [localization.sourceManifest.current.entryId] : []),
    ...localization.sourceManifest.priors.map((entry) => entry.entryId),
  ]);
  const localizedManifestLocaleByEntryHash = Object.fromEntries(
    [...selectedIds].map((id) => [fingerprintText(id), localization.targetLocaleByEntryId[id] || null]),
  );
  const sameLocaleBypassUsedByEntryHash = Object.fromEntries(
    Object.entries(localization.sourceByEntryId).map(([id, source]) => [
      fingerprintText(id),
      source === 'same_locale_authoritative',
    ]),
  );
  const localizedManifestCacheHitByEntryHash = Object.fromEntries(
    Object.entries(localization.sourceByEntryId).map(([id, source]) => [
      fingerprintText(id),
      source === 'validated_cache',
    ]),
  );
  const localizationLineageByEntryHash = Object.fromEntries(
    Object.entries(localization.lineageByEntryId).map(([id, lineage]) => [
      fingerprintText(id),
      lineage,
    ]),
  );
  const failureEvidence = localization.validationFailureEvidence;
  session.patch({
    summarySelectedEntryIdHashes: [...selectedIds].map((id) => fingerprintText(id)),
    summaryOmittedEntryIdHashes: (cv.experience || [])
      .map((entry) => entry.id)
      .filter((id) => !selectedIds.has(id))
      .map((id) => fingerprintText(id)),
    localizationPrimaryFailureReason: localization.primaryFailureReason,
    localizationProviderHttpStatus: localization.httpStatus,
    localizationProviderResponseKind: localization.apiResponseKind,
    localizationServerFallbackUsed: localization.serverFallbackUsed,
    localizationClientFallbackUsed: localization.clientFallbackUsed,
    localizationRecoveryAttempted: localization.localizationRecoveryAttempted,
    localizationRecoveryAccepted: localization.localizationRecoveryAccepted,
    localizationSelectedEntryCount: localization.selectedEntryCount,
    localizationSameLocaleBypassCount: localization.sameLocaleBypassCount,
    localizationValidatedCacheHitCount: localization.validatedCacheHitCount,
    localizationProviderEntryCount: localization.providerLocalizedEntryCount,
    localizationRecoveryEntryCount: localization.recoveryLocalizedEntryCount,
    localizedManifestLocaleByEntryHash,
    sameLocaleBypassUsedByEntryHash,
    localizedManifestCacheHitByEntryHash,
    localizationLineageByEntryHash,
    localizationSurfaceTransportPlans: localization.surfaceTransportPlans,
    localizationFailureEntryIdHash: failureEvidence
      ? fingerprintText(failureEvidence.entryId)
      : null,
    localizationFailureFactIdHash: failureEvidence?.factId
      ? fingerprintText(failureEvidence.factId)
      : null,
    localizationFailureSurfaceKind: failureEvidence?.surfaceKind || null,
    localizationFailureTextPreviewHash: failureEvidence?.textPreviewHash || null,
    localizationFailureDetectedLocale: failureEvidence?.detectedLocale || null,
    localizationFailureDetectedScript: failureEvidence?.detectedScript || null,
    localizationFailureTokenClass: failureEvidence?.tokenClass || null,
    localizationFailureProtectedEntityTokenClasses:
      failureEvidence?.protectedEntityTokenClasses || [],
  });
}

export default function CVBuilderPage() {
  const { t, locale } = useI18n();
  const {
    currentCv,
    setCurrentCv,
    persistCurrentCvTransactionally,
    isPro,
    canDownload,
    incrementDownloads,
    markAiRecommendUsed,
    recordProAiSuccess,
    getProAiUsageCount,
    lastCvSavedAt,
    getAiGate,
  } = useApp();
  const [cv, setCv] = useState<CVData>(currentCv || emptyCV());
  const cvRef = useRef<CVData>(cv);
  /** Last prepareExportReadyCv result for release diagnostics (non-PII). */
  const lastExportPrepareRef = useRef<PrepareExportReadyResult | null>(null);
  const lastExportRawCvRef = useRef<CVData | null>(null);
  /** Exact Summary surface last committed to a Preview template render. */
  const lastPreviewSummaryRenderRef = useRef<PreviewSummaryRenderEvidence | null>(null);
  /** Presentation-only result of the complete locale-safe PDF/DOCX pipeline. */
  const [terminalPreviewPresentation, setTerminalPreviewPresentation] = useState<{
    snapshotId: string;
    status: 'ready' | 'failed';
    cv: CVData | null;
    selectedFinalSummaryHash: string | null;
  } | null>(null);
  const terminalPreviewRequestRef = useRef(0);
  const prepareFinalLocaleSafeCvRef = useRef<((
    sourceCv: CVData,
    options?: { purpose?: 'export' | 'preview' },
  ) => Promise<CVData>) | null>(null);
  const lastExperienceLocalizationRef = useRef<ExperienceLocalizationDiagnostics | null>(null);
  const experienceLocalizationAbortRef = useRef<AbortController | null>(null);
  const exportInFlightRef = useRef(false);
  const [exportDiagTick, setExportDiagTick] = useState(0);
  // Stale-response correlation: each AI action tracks the requestId of its
  // most-recently-started request. An in-flight request whose id no longer
  // matches when its response arrives is a stale/out-of-order response and
  // must never be applied, regardless of which locale it was requested in.
  const latestSummaryRequestIdRef = useRef<string | null>(null);
  const latestBulletsRequestIdRef = useRef<Record<string, string>>({});
  /** Race guard: latest job-context key per experience for bullets AI. */
  const latestBulletsContextKeyRef = useRef<Record<string, string>>({});
  const latestRewriteRequestIdRef = useRef<string | null>(null);
  const summaryApplyOwnershipRef = useRef(createSummaryApplyOwnershipState());
  const experienceApplyOwnershipRef = useRef(createExperienceApplyOwnershipState());
  void SUMMARY_TRANSACTIONAL_APPLY_387_REVISION;
  void EXPERIENCE_TRANSACTION_OWNERSHIP_414_REVISION;
  const SUMMARY_CVREF_SINGLE_WRITER_REVISION =
    'summary-cvref-single-writer-411-v1' as const;
  void SUMMARY_CVREF_SINGLE_WRITER_REVISION;
  const commitCvUpdate = useCallback((updater: (prev: CVData) => CVData) => {
    setCv((prev) => {
      const next = updater(prev);
      cvRef.current = next;
      if (next.templateId !== prev.templateId) {
        setCurrentCv(next);
      }
      return next;
    });
  }, [setCurrentCv]);
  /** Synchronous Summary AI apply: cvRef first, then React + persist ownership. */
  const scheduleSummaryCvCommit = useCallback((next: CVData) => {
    // Keep cvRef authoritative even if React batches the setState updater.
    cvRef.current = next;
    setCv(next);
  }, []);
  const persistSummaryCvNow = useCallback((next: CVData) => {
    setCurrentCv(next);
  }, [setCurrentCv]);
  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [langName, setLangName] = useState('');
  const [langLevel, setLangLevel] = useState('');
  const [selectedLanguageName, setSelectedLanguageName] = useState<string | null>(null);
  const [showLanguageSuggestions, setShowLanguageSuggestions] = useState(false);
  const [jobDesc, setJobDesc] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{ missingSkills: string[]; keywords: string[]; suggestions: string[] } | null>(null);
  const [limitModal, setLimitModal] = useState<{ open: boolean; type: 'cv' | 'cl' }>({ open: false, type: 'cv' });
  const [jobAnalyzerModal, setJobAnalyzerModal] = useState(false);
  const [aiImprovementsModal, setAiImprovementsModal] = useState(false);
  const [summaryAiModal, setSummaryAiModal] = useState(false);
  const [proTemplateModal, setProTemplateModal] = useState(false);
  const [aiRecommendModal, setAiRecommendModal] = useState(false);
  const [expIndustry, setExpIndustry] = useState<Record<string, BulletIndustry>>({});
  const [expLevel, setExpLevel] = useState<Record<string, BulletLevel>>({});
  const [isSummaryGenerating, setIsSummaryGenerating] = useState(false);
  const [rewritingStyle, setRewritingStyle] = useState<string | null>(null);
  const [generatingBulletsId, setGeneratingBulletsId] = useState<string | null>(null);
  const [activeLanguageSuggestionIndex, setActiveLanguageSuggestionIndex] = useState(-1);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<TemplateId | null>(null);
  const [fullscreenTemplateId, setFullscreenTemplateId] = useState<TemplateId | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isWordExporting, setIsWordExporting] = useState(false);
  const stepButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const skillInputRef = useRef<HTMLInputElement | null>(null);
  const skillAutocompleteRef = useRef<HTMLDivElement | null>(null);
  const langInputRef = useRef<HTMLInputElement | null>(null);
  const langAutocompleteRef = useRef<HTMLDivElement | null>(null);
  const langSuggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    experienceLocalizationAbortRef.current?.abort();
    experienceLocalizationAbortRef.current = null;
    exportInFlightRef.current = false;
  }, []);


  useEffect(() => {
    if (currentCv) {
      if (!shouldAcceptIncomingSummaryCv({
        ownership: summaryApplyOwnershipRef.current,
        incomingCv: currentCv,
        localCvRef: cvRef.current,
      })) {
        return;
      }
      if (!shouldAcceptIncomingExperienceCv({
        ownership: experienceApplyOwnershipRef.current,
        incomingCv: currentCv,
        localCvRef: cvRef.current,
      })) {
        return;
      }
      setCv(currentCv);
      cvRef.current = currentCv;
    }
  }, [currentCv]);

  useEffect(() => {
    // Do not clobber a newer transactional Summary write with a stale React
    // render snapshot that has not yet absorbed scheduleSummaryCvCommit.
    const ownership = summaryApplyOwnershipRef.current;
    const nextHash = hashSummaryTextForApply(cv.summary);

    if (!shouldAcceptIncomingExperienceCv({
      ownership: experienceApplyOwnershipRef.current,
      incomingCv: cv,
      localCvRef: cvRef.current,
    })) {
      return;
    }
    syncCvRefFromReactState({
      cvRef,
      ownership,
      nextCv: cv,
      currentSummaryHash:
        hashSummaryTextForApply(
          cvRef.current.summary,
        ),
      nextSummaryHash: nextHash,
    });
  }, [cv]);

  // Commit legacy runtime migration atomically to React state, cvRef, and draft storage
  // so preview/PDF/DOCX cannot read a stale pre-migration snapshot.
  useEffect(() => {
    const source = cvRef.current;
    if (Number(source.runtimeMigrationVersion || 0) >= CV_RUNTIME_MIGRATION_VERSION) return;
    const migrated = normalizeLegacyCvRuntime(source, locale);
    cvRef.current = migrated;
    setCv(migrated);
    setCurrentCv(migrated);
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[CV runtime migration] committed', {
        fromVersion: Number(source.runtimeMigrationVersion || 0),
        toVersion: migrated.runtimeMigrationVersion,
        templateId: migrated.templateId,
        region: migrated.region,
        contentLocale: migrated.contentLocale,
        summaryOrigin: migrated.summaryOrigin,
        experienceCount: (migrated.experience || []).length,
      });
    }
  }, [locale, setCurrentCv, cv.id]);

  // ── Autosave: debounce-save to context (which persists to localStorage) ──────
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const scheduledGeneration = summaryApplyOwnershipRef.current.generation;
    const scheduledSummaryHash = hashSummaryTextForApply(cv.summary);
    summaryApplyOwnershipRef.current.pendingAutosaveSourceHash = scheduledSummaryHash;
    autosaveTimerRef.current = setTimeout(() => {
      const gate = shouldFlushSummaryAutosave({
        ownership: summaryApplyOwnershipRef.current,
        scheduledGeneration,
        scheduledSummaryHash,
        liveCvRef: cvRef.current,
      });
      if (!gate.flush || !gate.cvToPersist) {
        return;
      }
      const cvToPersist = shouldAcceptIncomingExperienceCv({
        ownership: experienceApplyOwnershipRef.current,
        incomingCv: gate.cvToPersist,
        localCvRef: cvRef.current,
      })
        ? gate.cvToPersist
        : cvRef.current;
      setCurrentCv(cvToPersist);
    }, 800);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv]);

  // Close download menu on outside click
  useEffect(() => {
    if (!showDownloadMenu) return;
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDownloadMenu]);

  const steps = [
    t.cv.personal,
    t.cv.experience,
    t.cv.education,
    t.cv.skills + ' & ' + t.cv.languages,
    t.cv.summary,
    t.cv.selectTemplate,
    t.cv.preview,
  ];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (langAutocompleteRef.current?.contains(event.target) || skillAutocompleteRef.current?.contains(event.target)) return;
      setShowLanguageSuggestions(false);
      setActiveLanguageSuggestionIndex(-1);
      setShowSkillSuggestions(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    stepButtonRefs.current[step]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [step]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;

      const tagName = target.tagName;
      return target.isContentEditable
        || tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT'
        || !!target.closest('[contenteditable="true"]');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (showPreview || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStep(prev => Math.max(0, prev - 1));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStep(prev => Math.min(steps.length - 1, prev + 1));
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setStep(0);
      }

      if (event.key === 'End') {
        event.preventDefault();
        setStep(steps.length - 1);
      }

      if (event.key === 'PageUp') {
        event.preventDefault();
        setStep(prev => Math.max(0, prev - 1));
      }

      if (event.key === 'PageDown') {
        event.preventDefault();
        setStep(prev => Math.min(steps.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreview, steps.length]);

  const updatePersonal = (field: string, value: string) => {
    setCv(prev => ({ ...prev, personal: { ...prev.personal, [field]: value }, updatedAt: new Date().toISOString() }));
  };

  const addExperience = () => setCv(prev => ({ ...prev, experience: [...prev.experience, emptyExp()] }));
  const removeExperience = (id: string) => {
    releaseExperienceApplyOwnership(experienceApplyOwnershipRef.current, id);
    setCv(prev => ({ ...prev, experience: prev.experience.filter(e => e.id !== id) }));
  };
  const updateExperience = (id: string, field: string, value: string | boolean) => {
    // Sync cvRef immediately so AI Improvement can read the latest textarea
    // without waiting for React's post-paint useEffect.
    if (field === 'description') {
      releaseExperienceApplyOwnership(experienceApplyOwnershipRef.current, id);
    }
    commitCvUpdate((prev) => applyCanonicalExperienceEdit(prev, id, field, value, locale));
  };

  const addEducation = () => setCv(prev => ({ ...prev, education: [...prev.education, emptyEdu()] }));
  const removeEducation = (id: string) => setCv(prev => ({ ...prev, education: prev.education.filter(e => e.id !== id) }));
  const updateEducation = (id: string, field: string, value: string) => {
    setCv((prev) => applyCanonicalSkillsLanguagesEducationEdit(prev, {
      education: prev.education.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  };

  const addSkill = (option?: CvSkillOption) => {
    const typedSkill = skillInput.trim();
    const resolvedSkill = option?.canonicalName ?? resolveStoredCvSkillName(typedSkill) ?? typedSkill;
    if (!resolvedSkill) return;

    setCv((prev) => {
      const normalizedNextSkill = (resolveStoredCvSkillName(resolvedSkill) ?? resolvedSkill).trim().toLocaleLowerCase();

      if (prev.skills.some((skill) => (resolveStoredCvSkillName(skill) ?? skill).trim().toLocaleLowerCase() === normalizedNextSkill)) {
        return prev;
      }

      return applyCanonicalSkillsLanguagesEducationEdit(prev, {
        skills: [...prev.skills, resolvedSkill],
      });
    });

    setSkillInput('');
    setShowSkillSuggestions(false);
  };
  const removeSkill = (idx: number) => setCv((prev) => applyCanonicalSkillsLanguagesEducationEdit(prev, {
    skills: prev.skills.filter((_, i) => i !== idx),
  }));

  const addCert = () => { if (certInput.trim()) { setCv(prev => ({ ...prev, certifications: [...prev.certifications, certInput.trim()] })); setCertInput(''); } };

  const skillSuggestions = useMemo(
    () => filterCvSkillOptions(skillInput, locale, cv.skills),
    [cv.skills, locale, skillInput],
  );

  // Get the most recently set industry across all work experiences (or undefined)
  const latestSelectedIndustry = useMemo(() => {
    const values = Object.values(expIndustry);
    return values.length > 0 ? values[values.length - 1] : undefined;
  }, [expIndustry]);

  const smartSkillSuggestions = useMemo(() => {
    // If an industry is selected, prioritize industry-based suggestions
    if (latestSelectedIndustry && latestSelectedIndustry !== 'general') {
      const industrySuggestions = getSkillSuggestionsByIndustry(latestSelectedIndustry, locale, cv.skills, 10);
      if (industrySuggestions.length > 0) return industrySuggestions;
    }
    // Use ALL work experience positions for a combined skill pool
    const jobTitles = cv.experience.map((exp) => exp.position).filter(Boolean);
    if (jobTitles.length > 0) {
      const result = getSkillSuggestionsByJobTitles(jobTitles, locale, cv.skills, 15);
      return result;
    }
    // Fall back to the overall job title if no experience entries exist
    return getSkillSuggestionsByJobTitle(cv.personal.jobTitle || '', locale, cv.skills, 10);
  }, [cv.experience, cv.personal.jobTitle, cv.skills, locale, latestSelectedIndustry]);

  const languageSuggestions = useMemo(
    () => filterCvLanguageOptions(langName, locale, cv.languages.map((language) => language.name)),
    [cv.languages, langName, locale],
  );

  // ── Three-source photo state ─────────────────────────────────────────────────
  // originalPhotoDataUrl: raw file from disk — NEVER circular/rect cropped.
  //   Set when PhotoUpload calls onChange with the third argument.
  // circularPhotoDataUrl: circular-clip PNG, used by circle-shaped templates.
  // rectangularPhotoDataUrl: 3:4 JPEG derived from originalPhotoDataUrl (not from the circular crop).
  const [originalPhotoDataUrl, setOriginalPhotoDataUrl] = useState<string | undefined>(
    () => {
      const draft = loadCvDraft();
      return getPersonalPhotoVariants(draft?.cv ?? cv).originalPhoto ?? draft?.originalPhoto;
    },
  );
  const [circularPhotoDataUrl, setCircularPhotoDataUrl] = useState<string | undefined>(
    () => {
      const draft = loadCvDraft();
      return getPersonalPhotoVariants(draft?.cv ?? cv).circularPhoto ?? draft?.circularPhoto;
    },
  );
  const [rectangularPhotoDataUrl, setRectangularPhotoDataUrl] = useState<string | undefined>(
    () => {
      const draft = loadCvDraft();
      return getPersonalPhotoVariants(draft?.cv ?? cv).rectangularPhoto ?? draft?.rectangularPhoto;
    },
  );
  const [validatedElegantFormalFallbackPhoto, setValidatedElegantFormalFallbackPhoto] = useState<string | undefined>(undefined);


  // Migrate polluted translated proficiency strings → canonical enum keys once on hydrate / locale churn.
  useEffect(() => {
    setCv((prev) => {
      const next = normalizeCvLanguagesProficiency(prev);
      const same = (prev.languages || []).every((lang, i) => lang.level === next.languages?.[i]?.level)
        && (prev.languages || []).length === (next.languages || []).length;
      return same ? prev : next;
    });
  }, [locale]);

  // rectangularPhotoDataUrl is set directly by handlePhotoChange from the crop modal output.
  // No useEffect re-generation — the crop modal produces it with the user's exact framing.
  useEffect(() => {
    const variants = getPersonalPhotoVariants(cv);
    const sourceOriginal = variants.originalPhoto;
    if (cv.templateId !== 'elegant-formal' || !sourceOriginal || variants.rectangularPhoto) return;
    let cancelled = false;
    createElegantFormalPortraitPhoto(sourceOriginal)
      .then(({ dataUrl }) => {
        if (cancelled) return;
        setRectangularPhotoDataUrl(prev => (prev === dataUrl ? prev : dataUrl));
        setCv(prev => {
          if (getPersonalPhotoVariants(prev).rectangularPhoto === dataUrl) return prev;
          const next = { ...prev, personal: { ...prev.personal, rectangularPhoto: dataUrl }, updatedAt: new Date().toISOString() };
          cvRef.current = next;
          setCurrentCv(next);
          return next;
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [cv, cv.templateId, setCurrentCv]);

  useEffect(() => {
    const variants = getPersonalPhotoVariants(cv);
    const rectPhoto = variants.rectangularPhoto;
    if (cv.templateId !== 'elegant-formal' || variants.originalPhoto || !rectPhoto) {
      setValidatedElegantFormalFallbackPhoto(undefined);
      return;
    }
    let cancelled = false;
    isCleanElegantFormalPortraitPhoto(rectPhoto)
      .then((isClean) => {
        if (!cancelled) setValidatedElegantFormalFallbackPhoto(isClean ? rectPhoto : undefined);
      })
      .catch(() => {
        if (!cancelled) setValidatedElegantFormalFallbackPhoto(undefined);
      });
    return () => { cancelled = true; };
  }, [cv, cv.templateId]);

  const photoForCurrentTemplate = useMemo(() => (
    cv.templateId === 'elegant-formal'
      ? (getPersonalPhotoVariants(cv).originalPhoto ? getPersonalPhotoVariants(cv).rectangularPhoto : validatedElegantFormalFallbackPhoto)
      : RECT_PHOTO_TEMPLATES.includes(cv.templateId)
      ? (getPersonalPhotoVariants(cv).rectangularPhoto ?? rectangularPhotoDataUrl ?? cv.personal.photo)
      : (getPersonalPhotoVariants(cv).circularPhoto ?? circularPhotoDataUrl ?? cv.personal.photo)
  ), [circularPhotoDataUrl, cv, rectangularPhotoDataUrl, validatedElegantFormalFallbackPhoto]);

  const hasLoadedElegantFormalPreviewPhoto = useCallback((preferredPreviewId?: string): boolean => {
    if (typeof document === 'undefined') return false;
    const roots = [
      preferredPreviewId ? document.getElementById(preferredPreviewId) : null,
      document.getElementById('cv-preview'),
      document.getElementById('cv-inline-preview'),
    ].filter(Boolean) as HTMLElement[];
    return roots.some((root) => {
      const img = root.querySelector<HTMLImageElement>('[data-template-id="elegant-formal"] img');
      return Boolean(img?.src && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
    });
  }, []);

  const getElegantFormalPreviewPhotoSrc = useCallback((preferredPreviewId?: string): string | undefined => {
    if (typeof document === 'undefined') return undefined;
    const roots = [
      preferredPreviewId ? document.getElementById(preferredPreviewId) : null,
      document.getElementById('cv-preview'),
      document.getElementById('cv-inline-preview'),
    ].filter(Boolean) as HTMLElement[];
    for (const root of roots) {
      const img = root.querySelector<HTMLImageElement>('[data-template-id="elegant-formal"] img');
      const src = stripPhotoCacheFragment(img?.currentSrc || img?.src || img?.getAttribute('src') || undefined);
      if (src) return src;
    }
    return undefined;
  }, []);

  const ensureElegantFormalPhotoForExport = useCallback(async (preferredPreviewId?: string): Promise<ElegantFormalCanonicalPhotoResult | null> => {
    const liveCv = cvRef.current;
    if (liveCv.templateId !== 'elegant-formal') return null;
    const draft = loadCvDraft();
    const personalVariants = getPersonalPhotoVariants(liveCv);
    const draftVariants = draft ? getPersonalPhotoVariants(draft.cv) : {};
    const originalPhoto = personalVariants.originalPhoto ?? draftVariants.originalPhoto ?? draft?.originalPhoto;
    const rectangularPhoto = personalVariants.rectangularPhoto ?? draftVariants.rectangularPhoto ?? draft?.rectangularPhoto;
    const previewPhoto = getElegantFormalPreviewPhotoSrc(preferredPreviewId);
    const currentPhoto = stripPhotoCacheFragment(liveCv.personal.photo);

    const metadata = [
      describeElegantFormalPhotoField('cv.personal.originalPhoto', personalVariants.originalPhoto),
      describeElegantFormalPhotoField('cv.personal.rectangularPhoto', personalVariants.rectangularPhoto),
      describeElegantFormalPhotoField('cv.personal.circularPhoto', personalVariants.circularPhoto),
      describeElegantFormalPhotoField('cv.personal.photo', liveCv.personal.photo),
      describeElegantFormalPhotoField('local.originalPhotoDataUrl', originalPhotoDataUrl),
      describeElegantFormalPhotoField('local.rectangularPhotoDataUrl', rectangularPhotoDataUrl),
      describeElegantFormalPhotoField('preview.img.src', previewPhoto),
    ];

    const tryPrepare = async (
      input: Parameters<typeof prepareElegantFormalCanonicalPhoto>[0],
      sourceField: string,
    ): Promise<ElegantFormalCanonicalPhotoResult | null> => {
      try {
        const result = await prepareElegantFormalCanonicalPhoto(input);
        if (result) {
          if (process.env.NODE_ENV !== 'production') {
            console.info('[Elegant Formal export photo]', [...metadata, `selectedSource=${sourceField}`, 'code=ELEGANT_FORMAL_PHOTO_READY'].join(' | '));
          }
          return result;
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Elegant Formal export photo]', [...metadata, `selectedSource=${sourceField}`, `code=ELEGANT_FORMAL_PHOTO_PREPARE_FAILED`, `detail=${err instanceof Error ? err.message : 'unknown'}`].join(' | '));
        }
      }
      return null;
    };

    const preparedPhoto =
      await tryPrepare({ originalPhoto, rectangularPhoto }, originalPhoto ? 'cv.personal.originalPhoto' : rectangularPhoto ? 'cv.personal.rectangularPhoto' : 'none')
      ?? await tryPrepare({ rectangularPhoto: previewPhoto }, 'preview.img.src')
      ?? await tryPrepare({ rectangularPhoto: currentPhoto }, 'cv.personal.photo');

    if (preparedPhoto) {
      const { dataUrl } = preparedPhoto;
      setRectangularPhotoDataUrl(prev => (prev === dataUrl ? prev : dataUrl));
      setCv(prev => {
        const next = {
          ...prev,
          personal: {
            ...prev.personal,
            originalPhoto: originalPhoto ?? getPersonalPhotoVariants(prev).originalPhoto,
            rectangularPhoto: dataUrl,
            photo: dataUrl,
            photoEnabled: prev.personal.photoEnabled ?? true,
          },
          updatedAt: new Date().toISOString(),
        };
        cvRef.current = next;
        setCurrentCv(next);
        return next;
      });
      return preparedPhoto;
    }

    const variants = getPersonalPhotoVariants(liveCv);
    const hasPersistedPhotoField = Boolean(
      variants.originalPhoto
      || variants.rectangularPhoto
      || variants.circularPhoto
      || liveCv.personal.photo
    );
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Elegant Formal export photo]', [
        ...metadata,
        `selectedSource=${hasPersistedPhotoField || hasLoadedElegantFormalPreviewPhoto(preferredPreviewId) ? 'recoverable-source-rejected' : 'none'}`,
        `code=${hasPersistedPhotoField || previewPhoto ? 'ELEGANT_FORMAL_PHOTO_STATE_MISMATCH' : 'ELEGANT_FORMAL_NO_PHOTO'}`,
      ].join(' | '));
    }
    return null;
  }, [getElegantFormalPreviewPhotoSrc, hasLoadedElegantFormalPreviewPhoto, originalPhotoDataUrl, rectangularPhotoDataUrl, setCurrentCv]);

  const prepareElegantFormalPdfPhotoDataUrl = useCallback(async (): Promise<string | null> => {
    const liveCv = cvRef.current;
    if (liveCv.templateId !== 'elegant-formal') return null;
    const personalVariants = getPersonalPhotoVariants(liveCv);
    const originalPhoto = personalVariants.originalPhoto;
    const rectangularPhoto = originalPhoto ? undefined : personalVariants.rectangularPhoto;
    const selectedSource = originalPhoto
      ? 'cv.personal.originalPhoto'
      : rectangularPhoto
        ? 'cv.personal.rectangularPhoto'
        : 'none';

    try {
      const prepared = await prepareElegantFormalCanonicalPhoto({ originalPhoto, rectangularPhoto });
      if (!prepared) {
        if (originalPhoto) throw new Error('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
        if (process.env.NODE_ENV !== 'production') {
          console.info('[Elegant Formal PDF photo]', `selectedSource=${selectedSource} | code=ELEGANT_FORMAL_PDF_NO_VALID_SOURCE`);
        }
        return null;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.info('[Elegant Formal PDF photo]', [
          `selectedSource=${selectedSource}`,
          `sourceType=${prepared.source}`,
          `sourceDimensions=${prepared.metrics?.sourceWidth ?? 'unknown'}x${prepared.metrics?.sourceHeight ?? 'unknown'}`,
          `canonicalDimensions=${prepared.width}x${prepared.height}`,
          `mime=${prepared.mimeType}`,
          'code=ELEGANT_FORMAL_PDF_PHOTO_READY',
        ].join(' | '));
      }

      setRectangularPhotoDataUrl(prev => (prev === prepared.dataUrl ? prev : prepared.dataUrl));
      setCv(prev => {
        const next = {
          ...prev,
          personal: {
            ...prev.personal,
            originalPhoto: originalPhoto ?? getPersonalPhotoVariants(prev).originalPhoto,
            rectangularPhoto: prepared.dataUrl,
            photoEnabled: prev.personal.photoEnabled ?? true,
          },
          updatedAt: new Date().toISOString(),
        };
        cvRef.current = next;
        setCurrentCv(next);
        return next;
      });
      return prepared.dataUrl;
    } catch (err) {
      if (originalPhoto) throw new Error('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Elegant Formal PDF photo]', [
          `selectedSource=${selectedSource}`,
          'code=ELEGANT_FORMAL_PDF_PHOTO_PREPARE_FAILED',
          `detail=${err instanceof Error ? err.message : 'unknown'}`,
        ].join(' | '));
      }
      return null;
    }
  }, [setCurrentCv]);

  // Preview and export start from the same live content authority. React state
  // supplies only the selected template; cvRef owns the current visible draft.
  const previewInputCv = resolveCvExportSourceAuthority(cvRef.current, cv.templateId);
  const previewPrimaryExpId = (previewInputCv.experience || []).find((entry) => entry.isPresent)?.id
    || (previewInputCv.experience || [])[0]?.id;
  const previewIndustry = previewPrimaryExpId
    ? (expIndustry[previewPrimaryExpId] ?? 'general')
    : 'general';
  const previewLevel = previewPrimaryExpId
    ? (expLevel[previewPrimaryExpId] ?? 'mid')
    : 'mid';
  const previewGender = previewInputCv.personal?.gender;
  const previewPrepareOptions = useMemo(() => ({
    gender: previewGender,
    industry: previewIndustry,
    level: previewLevel,
  }), [previewGender, previewIndustry, previewLevel]);
  const previewInputSnapshotId = buildPreviewSummarySnapshotId(
    previewInputCv,
    locale,
    previewPrepareOptions,
  );
  const matchingTerminalPreview = terminalPreviewPresentation?.snapshotId === previewInputSnapshotId
    ? terminalPreviewPresentation
    : null;
  const previewDerivationInputCv = matchingTerminalPreview?.status === 'ready'
    && matchingTerminalPreview.cv
    ? matchingTerminalPreview.cv
    : previewInputCv;
  const previewSourceRuntimeCv = normalizeLegacyCvRuntime(previewInputCv, locale);
  // Any non-user Summary is app-owned terminal material.  Restricting this
  // to the three historical origin labels let newer deterministic manifest
  // results render the stale editor Summary while the async terminal snapshot
  // was still being acquired.
  const previewSourceIsAppOwned = previewSourceRuntimeCv.summaryOrigin !== 'user';
  const terminalPreviewReady = Boolean(
    matchingTerminalPreview?.status === 'ready' && matchingTerminalPreview.cv,
  );

  const localizedPreviewPresentation = useMemo<{
    cv: CVData;
    summaryRender: PreviewSummaryRenderEvidence;
  }>(
    () => {
      const migratedCv = normalizeLegacyCvRuntime(previewDerivationInputCv, locale);
      const appOwnedPreviewSummary = migratedCv.summaryOrigin === 'deterministic_fallback'
        || migratedCv.summaryOrigin === 'ai_generated'
        || migratedCv.summaryOrigin === 'ai_repaired';
      const previewSourceCv = migratedCv;
      const presentation = resolveExperiencePresentationSnapshot({
        cv: previewSourceCv,
        targetLocale: locale,
      });
      // Preserve the source-bound Experience terminal snapshot before any
      // display-only content normalization.  In particular, an app-owned
      // stale Summary must be validated against its saved ownership surface,
      // not a quality-normalized fragment that can no longer expose the stale
      // employer/date attachment.
      const terminalExperienceCv = applyTerminalExperiencePresentationSnapshot(
        presentation.cv,
        presentation,
      );
      const qualityCv = applyCvContentQuality(terminalExperienceCv, locale, {
        gender: previewSourceCv.personal?.gender,
        summaryOrigin: previewSourceCv.summaryOrigin,
      }).cv;
      // The shared presentation snapshot is terminal for Experience display.
      // Content-quality normalization is allowed to improve other fields, but
      // must never reconstruct a source-language description after that entry
      // was intentionally unresolved by the target-aware presentation contract.
      const terminalPresentationCv = applyTerminalExperiencePresentationSnapshot(
        qualityCv,
        presentation,
      );
      // The async locale-safe pipeline has already established the selected
      // final Summary. Content-quality may normalize other Preview fields, but
      // it must not re-run Summary recovery against that post-final CV or
      // replace its selected surface. User-authored Summary prose remains on
      // the ordinary synchronous path.
      const terminalSelectedSummaryHash = matchingTerminalPreview?.selectedFinalSummaryHash || null;
      const summaryTerminalCv = appOwnedPreviewSummary
        ? terminalPreviewReady && terminalSelectedSummaryHash
          ? {
            ...terminalPresentationCv,
            summary: migratedCv.summary,
            summaryOrigin: migratedCv.summaryOrigin,
            summaryGeneratedLocale: migratedCv.summaryGeneratedLocale,
          }
          : { ...terminalPresentationCv, summary: '' }
        : terminalPresentationCv;
      const localeSafeCv = omitInvalidLocalizedFieldsForPreview(summaryTerminalCv, locale);
      const base = {
        ...localeSafeCv,
        skills: localeSafeCv.skills.map((skill) => getLocalizedCvSkillName(skill, locale)),
        languages: localeSafeCv.languages.map((language) => ({
          ...language,
          name: getLocalizedCvLanguageName(language.name, locale),
        })),
      };
      const finalizePreview = (previewCv: CVData) => ({
        cv: previewCv,
        // This hashes the exact `data` object supplied to TemplateComponent;
        // it cannot be a pre-render selected-candidate surrogate.
        summaryRender: describePreviewSummaryRender(
          previewCv,
          null,
          appOwnedPreviewSummary,
          {
            previewSnapshotId: previewInputSnapshotId,
            previewInputSummaryHash: hashSummaryV2Text(previewCv.summary || ''),
            previewSourceSummaryHash: hashSummaryV2Text(previewSourceRuntimeCv.summary || ''),
            selectedFinalSummaryHash: terminalSelectedSummaryHash,
          },
        ),
      });
      if (RECT_PHOTO_TEMPLATES.includes(cv.templateId)) {
        // Rectangle templates: use rectangular photo derived from the original upload.
        // Append '#rect' cache-buster so the browser never reuses a stale circular decode.
        const rectUrl = cv.templateId === 'elegant-formal'
          ? (getPersonalPhotoVariants(cv).originalPhoto ? getPersonalPhotoVariants(cv).rectangularPhoto : validatedElegantFormalFallbackPhoto)
          : (getPersonalPhotoVariants(cv).rectangularPhoto ?? rectangularPhotoDataUrl ?? cv.personal.photo);
        if (rectUrl) {
          const cacheBustedUrl = rectUrl.includes('#') ? rectUrl : rectUrl + '#rect';
          return finalizePreview({ ...base, personal: { ...base.personal, photo: cacheBustedUrl } });
        }
        // No original available — hide photo rather than show circular crop in a rect frame
        return finalizePreview({ ...base, personal: { ...base.personal, photo: undefined } });
      }
      // Circle templates: use the circular crop stored in circularPhotoDataUrl.
      // Fall back to cv.personal.photo for any existing data loaded from storage.
      const circleUrl = getPersonalPhotoVariants(cv).circularPhoto ?? circularPhotoDataUrl;
      if (circleUrl) {
        return finalizePreview({ ...base, personal: { ...base.personal, photo: circleUrl } });
      }
      return finalizePreview(base);
    },
    [
      cv,
      previewDerivationInputCv,
      previewSourceRuntimeCv.summary,
      locale,
      circularPhotoDataUrl,
      rectangularPhotoDataUrl,
      validatedElegantFormalFallbackPhoto,
      previewInputSnapshotId,
      terminalPreviewReady,
      matchingTerminalPreview?.selectedFinalSummaryHash,
    ],
  );

  const localizedPreviewCv = localizedPreviewPresentation.cv;

  useEffect(() => {
    const previewRootId = showPreview
      ? 'cv-preview'
      : step === steps.length - 1
        ? 'cv-inline-preview'
        : null;
    if (!previewRootId) return;
    const root = document.getElementById(previewRootId);
    if (!root) return;
    // This runs after React commits the selected template leaf. Evidence is
    // accepted only when the exact Summary supplied in `data` is present in
    // that real DOM subtree; intended candidates cannot self-certify.
    lastPreviewSummaryRenderRef.current = commitPreviewSummaryLeafEvidence(
      localizedPreviewPresentation.summaryRender,
      localizedPreviewCv.summary || '',
      root.textContent || '',
    );
  }, [
    localizedPreviewPresentation,
    localizedPreviewCv.summary,
    showPreview,
    step,
    steps.length,
  ]);

  useEffect(() => {
    if (!selectedLanguageName) return;
    setLangName(getLocalizedCvLanguageName(selectedLanguageName, locale));
  }, [locale, selectedLanguageName]);

  const selectLanguageSuggestion = (option: CvLanguageOption) => {
    setSelectedLanguageName(option.canonicalName);
    setLangName(option.localizedLabel);
    setShowLanguageSuggestions(false);
    setActiveLanguageSuggestionIndex(-1);
  };

  const focusLanguageInput = () => {
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => langInputRef.current?.focus());
      return;
    }

    langInputRef.current?.focus();
  };

  const addLanguage = (option?: CvLanguageOption) => {
    const resolvedName = option?.canonicalName
      ?? selectedLanguageName
      ?? resolveStoredCvLanguageName(langName);

    if (!resolvedName) return;

    setCv((prev) => {
      if (prev.languages.some((language) => language.name === resolvedName)) return prev;
      const canonicalLevel = normalizeLanguageProficiencyToCanonical(
        langLevel || 'intermediate',
      );
      return applyCanonicalSkillsLanguagesEducationEdit(prev, {
        languages: [
          ...prev.languages,
          { name: resolvedName, level: canonicalLevel || 'intermediate' },
        ],
      });
    });

    setLangName('');
    setLangLevel('');
    setSelectedLanguageName(null);
    setShowLanguageSuggestions(false);
  };

  const handlePhotoChange = (photo: string | undefined, enabled: boolean, originalPhoto?: string, rectPhoto?: string) => {
    // photo        = circle PNG (or rect JPEG when photoShape='rectangle' during the crop session)
    // originalPhoto = raw file data URL — kept for reference / re-crop
    // rectPhoto    = 300×400 JPEG generated with the exact same zoom/offset the user chose
    if (photo === undefined) {
      setOriginalPhotoDataUrl(undefined);
      setCircularPhotoDataUrl(undefined);
      setRectangularPhotoDataUrl(undefined);
      setCv(prev => {
        const next = {
          ...prev,
          personal: {
            ...prev.personal,
            photo: undefined,
            photoEnabled: enabled,
            originalPhoto: undefined,
            circularPhoto: undefined,
            rectangularPhoto: undefined,
          },
          updatedAt: new Date().toISOString(),
        };
        cvRef.current = next;
        setCurrentCv(next);
        return next;
      });
      return;
    }

    const nextOriginal = originalPhoto;
    const nextCircular = photo;
    const nextRectangular = rectPhoto;
    if (nextOriginal) setOriginalPhotoDataUrl(nextOriginal);
    setCircularPhotoDataUrl(nextCircular);
    if (nextRectangular) setRectangularPhotoDataUrl(nextRectangular);

    setCv(prev => {
      const next = {
        ...prev,
        personal: {
          ...prev.personal,
          photo,
          photoEnabled: enabled,
          originalPhoto: nextOriginal ?? getPersonalPhotoVariants(prev).originalPhoto,
          circularPhoto: nextCircular ?? getPersonalPhotoVariants(prev).circularPhoto,
          rectangularPhoto: nextRectangular ?? getPersonalPhotoVariants(prev).rectangularPhoto,
        },
        updatedAt: new Date().toISOString(),
      };
      cvRef.current = next;
      setCurrentCv(next);
      return next;
    });
  };

  const getCurrentProTokenOrToast = (openUpgradeModal: () => void) => {
    const aiGate = getAiGate();
    const usageCount = getProAiUsageCount();
    const gateAccess = checkProAccess(aiGate.status !== 'free', usageCount);
    if (gateAccess !== 'allowed') {
      if (gateAccess === 'upgrade') {
        openUpgradeModal();
        return null;
      }
      toast.error(aiErrorMessage('pro_safety_limit_reached', locale));
      return null;
    }
    if (aiGate.status === 'syncing') {
      toast.error(t.common.proAuthorizationUnavailable);
      return null;
    }
    const circuitErr = precheckAiCircuit(locale);
    if (circuitErr) {
      toast.error(aiErrorMessage(circuitErr.code, locale, circuitErr.retryAfterSec));
      return null;
    }
    return aiGate.status === 'ready' ? aiGate.token : null;
  };

  const handleGenSummary = async () => {
    const proToken = getCurrentProTokenOrToast(() => setSummaryAiModal(true));
    if (!proToken) return;
    if (isSummaryGenerating) return;
    const liveCvAtPress = cvRef.current;
    const liveSummaryAtPress = (liveCvAtPress.summary || '').trim();
    const operationMode = resolveAiButtonOperationMode('summary_generate', liveSummaryAtPress);
    if (
      operationMode === 'generate_from_context'
      && !hasSufficientSummaryGenerationContext(liveCvAtPress)
    ) {
      toast.error(aiErrorMessage('summary_generation_failed', locale));
      return;
    }
    setIsSummaryGenerating(true);
    const controller = new AbortController();
    const clientTimeoutMs = resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS);
    const timer = setTimeout(() => controller.abort(), clientTimeoutMs);
    // Immutable request context: `reqCtx.locale` is captured once, at button-press
    // time, and is the ONLY locale used for the API call, validation, and apply
    // below — never re-read the (possibly since-changed) `locale` closure/UI value
    // partway through the request.
    const reqCtx = beginAiClientRequest('summary', locale);
    const requestedLocale = reqCtx.locale as Locale;
    const previousContentLocale = liveCvAtPress.canonicalSnapshot?.canonicalLocale ?? null;
    latestSummaryRequestIdRef.current = reqCtx.requestId;
    const countBefore = getProAiUsageCount();
    const primaryExpForJobCtx = resolveSummaryCurrentRole(liveCvAtPress.experience || []);
    const summaryJobContext = buildExperienceJobContext({
      position: primaryExpForJobCtx?.position || liveCvAtPress.personal?.jobTitle,
      locale: requestedLocale,
    });
    const summaryDiag = new SummaryAiDiagnosticSession({
      uiLocale: locale,
      requestedLocale,
      contentLocale: previousContentLocale || liveCvAtPress.contentLocale || null,
      templateId: String(liveCvAtPress.templateId || ''),
      gender: liveCvAtPress.personal.gender || '',
      requestId: reqCtx.requestId,
      usageCountBefore: countBefore,
      operationMode,
      jobContextHash: summaryJobContext.key,
    });
    summaryDiag.recordCvSnapshot(liveCvAtPress, liveSummaryAtPress);
    try {
      // Shared deterministic duration — never let each locale estimate independently.
      const referenceDateIso = new Date().toISOString().slice(0, 10);
      const durationSnapshot = buildExperienceDurationSnapshot(liveCvAtPress.experience, referenceDateIso);
      const experienceDuration = durationToPromptToken(durationSnapshot.total);
      const localization = await resolveSummaryLocalizedManifest({
        cv: liveCvAtPress,
        locale: requestedLocale,
        gender: liveCvAtPress.personal.gender || '',
        referenceDateIso,
        proToken,
        requestId: reqCtx.requestId,
        signal: controller.signal,
      });
      recordSummaryLocalizationDiagnostics(summaryDiag, localization, liveCvAtPress);
      if (!localization.manifest) {
        summaryDiag.stage('localization', 'fail', localization.reason || 'localization_provider_failed');
        summaryDiag.recordPreCandidateTerminalFailure({
          stage: 'localization',
          reason: localization.reason || 'localization_provider_failed',
          usageAfter: countBefore,
          localizationHttpStatus: localization.httpStatus,
          localizationApiResponseKind: localization.apiResponseKind,
          localizationServerFallbackUsed: localization.serverFallbackUsed,
          localizationClientFallbackUsed: localization.clientFallbackUsed,
          serverFallbackUsed: localization.serverFallbackUsed,
          clientFallbackUsed: localization.clientFallbackUsed,
        });
        toast.error(aiErrorMessage('generation_validation_failed', requestedLocale));
        return;
      }
      summaryDiag.stage('localization', 'ok', localization.localizationSource || undefined);
      const experienceEntries = buildSummaryV2ProviderExperienceEntries({
        manifest: localization.sourceManifest,
        localized: localization.manifest,
      });
      if (!experienceEntries) {
        summaryDiag.stage('localization', 'fail', 'localized_manifest_projection_failed');
        summaryDiag.recordPreCandidateTerminalFailure({
          stage: 'localization',
          reason: 'localized_manifest_projection_failed',
          usageAfter: countBefore,
          localizationHttpStatus: localization.httpStatus,
          localizationApiResponseKind: 'validation_rejected',
          localizationServerFallbackUsed: localization.serverFallbackUsed,
          localizationClientFallbackUsed: localization.clientFallbackUsed,
        });
        toast.error(aiErrorMessage('generation_validation_failed', requestedLocale));
        return;
      }

      const { data: summaryData, response: res } = await apiFetch<{ result?: string; error?: string; code?: string; retryAfter?: number }>('/api/generate', {
        body: {
          action: 'summary',
          proToken,
          jobTitle: experienceEntries[0]?.position || liveCvAtPress.personal.jobTitle,
          experienceDuration,
          experienceDurationSnapshot: durationSnapshot,
          referenceDateIso,
          experienceEntries,
          skills: liveCvAtPress.skills.slice(0, 10),
          languages: liveCvAtPress.languages.slice(0, 4),
          education: liveCvAtPress.education.slice(0, 2).map(e => ({ degree: e.degree, school: e.school })),
          locale: requestedLocale,
          gender: liveCvAtPress.personal.gender || '',
          canonicalSummary: liveCvAtPress.canonicalSummary || '',
          requestId: reqCtx.requestId,
          operationMode,
        },
        signal: controller.signal,
      });
      if (!res.ok || summaryData?.error) {
        if (res.status === 403) {
          const payload = resolveAiHttpFailure({ response: res, body: summaryData ?? null });
          const msg = finishAiClientRequest({
            ctx: reqCtx,
            isProVerified: getAiGate().status === 'ready',
            countBefore,
            countAfter: countBefore,
            httpStatus: res.status,
            error: payload,
          });
          summaryDiag.stage('api_response', 'fail', 'http_403');
          summaryDiag.patch({
            finalTypedFailureReason: payload.code || 'http_403',
            rejectionStage: 'api_response',
            countedAsSuccess: false,
          });
          summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'api_response_not_accepted');
          if (getAiGate().status !== 'free') toast.error(msg ?? t.common.proAuthorizationUnavailable);
          else setSummaryAiModal(true);
          return;
        }
        const payload = resolveAiHttpFailure({ response: res, body: summaryData });
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: payload,
        });
        summaryDiag.stage('api_response', 'fail', payload.code || 'http_error');
        summaryDiag.patch({
          finalTypedFailureReason: payload.code || 'http_error',
          rejectionStage: 'api_response',
          countedAsSuccess: false,
        });
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'api_response_not_accepted');
        toast.error(msg ?? aiErrorMessage('provider_temporarily_unavailable', locale));
        return;
      }
      // Stale-response guard: if another summary request started after this one
      // (e.g. the user pressed Generate again), drop this response silently —
      // it must never overwrite a newer request's result or locale.
      if (latestSummaryRequestIdRef.current !== reqCtx.requestId) {
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'summary_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_request_superseded',
        });
        summaryDiag.stage('race_guard', 'fail', 'stale_request_superseded');
        summaryDiag.patch({
          raceGuardResult: 'fail',
          finalTypedFailureReason: 'stale_request_superseded',
          rejectionStage: 'race_guard',
          countedAsSuccess: false,
        });
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'stale_request_superseded');
        return;
      }
      const liveNow = cvRef.current;
      if ((liveNow.summary || '').trim() !== liveSummaryAtPress) {
        finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'ai_request_stale', httpStatus: 409 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'summary_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_summary_edited_in_flight',
        });
        summaryDiag.stage('race_guard', 'fail', 'stale_summary_edited_in_flight');
        summaryDiag.patch({
          raceGuardResult: 'fail',
          finalTypedFailureReason: 'stale_summary_edited_in_flight',
          rejectionStage: 'race_guard',
          countedAsSuccess: false,
        });
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'stale_summary_edited_in_flight');
        return;
      }
      if (!summaryV2SnapshotMatchesCv({
        cv: liveNow,
        locale: requestedLocale,
        gender: liveCvAtPress.personal.gender || '',
        referenceDateIso,
        expectedSnapshotHash: localization.sourceManifest.snapshotHash,
      })) {
        summaryDiag.stage('race_guard', 'fail', 'stale_experience_edited_in_flight');
        summaryDiag.patch({
          actualRaceDetected: true,
          actualRaceReason: 'stale_experience_edited_in_flight',
          raceGuardResult: 'fail',
          finalTypedFailureReason: 'stale_experience_edited_in_flight',
          rejectionStage: 'race_guard',
          countedAsSuccess: false,
        });
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'stale_experience_edited_in_flight');
        toast.error(aiErrorMessage('ai_request_stale', locale));
        return;
      }
      const nextSummary = (summaryData?.result ?? '').trim();
      const finalizedGate = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale,
        gender: liveNow.personal.gender || '',
        cv: liveNow,
        candidate: nextSummary,
        durationSnapshot,
        localizedSummaryManifest: localization.manifest,
      });
      if (finalizedGate.blocked || !finalizedGate.countedAsSuccess) {
        const outcome = resolveSummaryFinalizeClientOutcome(
          finalizedGate,
          'summary_generation_failed',
        );
        if (outcome.kind === 'clean_noop') {
          finishAiClientRequest({
            ctx: reqCtx,
            isProVerified: true,
            countBefore,
            countAfter: countBefore,
            httpStatus: res.status,
            error: null,
            responseSource: 'blocked',
          });
          logAiLocaleTransitionDiagnostics({
            requestId: reqCtx.requestId,
            action: 'summary_generate',
            uiLocale: locale,
            requestedLocale,
            previousContentLocale,
            apiLocale: requestedLocale,
            finalValidationLocale: requestedLocale,
            applied: false,
            reason: 'summary_noop_after_normalization',
          });
          summaryDiag.recordFinalizeResult(finalizedGate);
          summaryDiag.recordVisibleApplyNotApplicable(countBefore);
          toast.error(aiErrorMessage('ai_noop', locale));
          return;
        }
        const failCode = outcome.toastCode || 'generation_validation_failed';
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'summary_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: finalizedGate.reason || failCode,
        });
        summaryDiag.recordFinalizeResult(finalizedGate);
        summaryDiag.recordVisibleApplySkippedFailure(
          countBefore,
          finalizedGate.reason || 'final_candidate_rejected',
        );
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      summaryDiag.recordFinalizeResult(finalizedGate);
      const preApplyGate = summaryDiag.evaluatePreApplyDecisionGates();
      if (!preApplyGate.passed) {
        const failCode = mapExperienceAiFailureToErrorCode(
          preApplyGate.reason || 'diagnostic_invariant_failed',
        );
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        summaryDiag.recordVisibleApplySkippedFailure(
          countBefore,
          preApplyGate.reason || 'diagnostic_preapply_gate_failed',
        );
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      const finalizedText = (finalizedGate.text || '').trim();
      const identicalNoop = Boolean(
        finalizedText
        && (
          finalizedText === liveSummaryAtPress
          || finalizedGate.reason === 'summary_noop_after_normalization'
          || finalizedGate.diagnostics?.noOpDetected
          || (
            liveSummaryAtPress
            && finalizedGate.diagnostics?.finalMatchesSourceAfterNormalization
            && finalizedGate.diagnostics?.meaningfulChangeDetected === false
          )
        ),
      );
      if (identicalNoop || finalizedGate.reason === 'summary_noop_after_normalization') {
        finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: null,
          responseSource: 'blocked',
        });
        summaryDiag.recordFinalizeResult({
          ...finalizedGate,
          blocked: true,
          countedAsSuccess: false,
          reason: finalizedGate.reason || 'summary_noop_after_normalization',
          diagnostics: {
            ...finalizedGate.diagnostics,
            countedAsSuccess: false,
            noOpDetected: true,
            noOpRejectionReason: 'summary_noop_after_normalization',
            meaningfulChangeDetected: false,
            finalMatchesSourceAfterNormalization: true,
            typedFailureReason: undefined,
            rejectionStage: undefined,
          },
        });
        summaryDiag.recordVisibleApplyNotApplicable(countBefore);
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'summary_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'summary_ai_noop_identical',
          newContentLocale: requestedLocale,
        });
        toast.error(aiErrorMessage('ai_noop', locale));
        return;
      }
      const applyCommit = commitSummaryApplyTransactionally({
        cvRef,
        ownership: summaryApplyOwnershipRef.current,
        locale: requestedLocale,
        finalized: finalizedGate,
        operationSourceText: liveSummaryAtPress,
        operationId: reqCtx.requestId,
        scheduleReactCv: scheduleSummaryCvCommit,
        persistCv: persistSummaryCvNow,
      });
      summaryDiag.patch({
        ...applyCommit.lifecycle,
        staleAutosaveWriteSuppressed: Boolean(
          summaryApplyOwnershipRef.current.lastStaleAutosaveSuppressedHash,
        ),
      });
      if (!applyCommit.ok) {
        const classified = classifySummaryVisibleApplyFailure({
          lifecycle: applyCommit.lifecycle,
          visibleHash: applyCommit.lifecycle.cvRefHashImmediatelyAfterWrite,
          selectedFinalHash: applyCommit.lifecycle.selectedFinalHash,
        });
        summaryDiag.patch({
          actualRaceDetected: classified.actualRaceDetected,
          actualRaceReason: classified.actualRaceReason,
          visibleApplyFailureStage: classified.visibleApplyFailureStage,
          raceGuardResult: classified.raceGuardResult,
          finalTypedFailureReason: classified.finalTypedFailureReason,
        });
        const failCode = mapExperienceAiFailureToErrorCode(
          classified.finalTypedFailureReason || 'summary_state_write_failed',
        );
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        summaryDiag.recordVisibleApply(false, countBefore);
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      // Visible validation must read the operation-owned written Summary
      // — never a stale React/render Summary snapshot (AAB-381 / AAB-387).
      const visibleSummaryText = resolveAuthoritativeVisibleSummaryText({
        operationOwnedSummary: applyCommit.writtenSummary,
        staleReactSummary: '',
      });
      // Visible validation must pass before usage increment (AAB-326).
      summaryDiag.recordVisibleApply(true, countBefore, visibleSummaryText);
      const visibleOk = summaryDiag.visibleApplySucceeded;
      if (!visibleOk) {
        const classified = classifySummaryVisibleApplyFailure({
          lifecycle: {
            ...applyCommit.lifecycle,
            visibleApplyFailureStage: 'post_write_visible_hash_mismatch',
          },
          visibleHash: hashSummaryTextForApply(visibleSummaryText),
          selectedFinalHash: applyCommit.lifecycle.selectedFinalHash,
        });
        summaryDiag.patch({
          actualRaceDetected: classified.actualRaceDetected,
          actualRaceReason: classified.actualRaceReason,
          visibleApplyFailureStage: classified.visibleApplyFailureStage,
          raceGuardResult: classified.raceGuardResult,
          finalTypedFailureReason: classified.finalTypedFailureReason
            || summaryDiag.finalTypedFailureReason,
        });
        const failReason = classified.finalTypedFailureReason
          || summaryDiag.finalTypedFailureReason
          || 'summary_state_write_failed';
        const failCode = mapExperienceAiFailureToErrorCode(failReason);
        rollbackSummaryApplyTransactionally({
          cvRef,
          ownership: summaryApplyOwnershipRef.current,
          operationSourceText: liveSummaryAtPress,
          scheduleReactCv: scheduleSummaryCvCommit,
          persistCv: persistSummaryCvNow,
        });
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        summaryDiag.patch({
          countedAsSuccess: false,
          usageCountAfter: countBefore,
          visibleApplySucceeded: false,
        });
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      recordProAiSuccess();
      summaryDiag.patch({ usageCountAfter: countBefore + 1 });
      finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore + 1,
        httpStatus: res.status,
        error: null,
        fallbackUsed: finalizedGate.origin === 'deterministic_fallback',
        responseSource: finalizedGate.origin === 'deterministic_fallback' ? 'deterministic_fallback' : 'provider',
      });
      logAiLocaleTransitionDiagnostics({
        requestId: reqCtx.requestId,
        action: 'summary_generate',
        uiLocale: locale,
        requestedLocale,
        previousContentLocale,
        apiLocale: requestedLocale,
        finalValidationLocale: requestedLocale,
        applied: true,
        newContentLocale: requestedLocale,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'summary_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: false,
        applied: true,
      });
      toast.success(t.cv.genSuccess);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[Professional Summary] Generate error');
      const payload = resolveAiHttpFailure({ response: null, error: err });
      const msg = finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore,
        httpStatus: null,
        error: payload,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'summary_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: err instanceof Error && err.name === 'AbortError',
        applied: false,
        reason: payload.code,
      });
      summaryDiag.stage('api_response', 'fail', payload.code || 'network_error');
      summaryDiag.patch({
        finalTypedFailureReason: payload.code || 'network_error',
        rejectionStage: 'api_response',
        countedAsSuccess: false,
      });
      summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'request_failed_before_apply');
      toast.error(msg ?? aiErrorMessage(payload.code === 'network_error' ? 'network_error' : 'provider_temporarily_unavailable', locale));
    } finally {
      await terminalizeAiDiagnosticSession(summaryDiag);
      clearTimeout(timer);
      setIsSummaryGenerating(false);
    }
  };

  const handleGenBullets = async (expId: string) => {
    // Snapshot the clicked stable entry ID immediately — never re-bind to
    // array index 0 or the globally current role while the request runs.
    const clickedExperienceEntryId = String(expId || '').trim();
    if (!clickedExperienceEntryId) return;

    // Always read the latest committed CV — never a stale closure snapshot.
    const liveCv = cvRef.current;
    const expFromState = liveCv.experience.find(e => e.id === clickedExperienceEntryId);
    if (!expFromState) return;
    if (generatingBulletsId) return; // Prevent multiple concurrent requests

    // Prefer the visible DOM textarea value over any lagged React/cvRef snapshot.
    let liveDescription = (expFromState.description || '').trim();
    if (typeof document !== 'undefined') {
      const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(clickedExperienceEntryId)
        : clickedExperienceEntryId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const domField = document.querySelector(
        `[data-experience-description-id="${escapedId}"]`,
      ) as HTMLTextAreaElement | null;
      if (domField && typeof domField.value === 'string') {
        liveDescription = domField.value;
      }
    }
    const exp = liveDescription === (expFromState.description || '')
      ? expFromState
      : { ...expFromState, description: liveDescription };

    const industry = expIndustry[clickedExperienceEntryId] ?? 'general';
    const level = expLevel[clickedExperienceEntryId] ?? 'mid';
    const requestContext = buildExperienceJobContext({
      position: exp.position,
      industry,
      locale,
      level,
    });

    const proToken = getCurrentProTokenOrToast(() => setAiImprovementsModal(true));
    if (!proToken) return;

    setGeneratingBulletsId(clickedExperienceEntryId);
    const controller = new AbortController();
    const clientTimeoutMs = resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS);
    const timer = setTimeout(() => controller.abort(), clientTimeoutMs);
    // Immutable request context — see handleGenSummary for the same pattern.
    const reqCtx = beginAiClientRequest('bullets', locale);
    const requestedLocale = reqCtx.locale as Locale;
    const previousContentLocale = liveCv.canonicalSnapshot?.canonicalLocale
      ?? liveCv.contentLocale
      ?? null;
    // Requested UI locale is the TARGET. Stored content locale stays until apply.
    const operationalContentLocale = previousContentLocale || requestedLocale;
    latestBulletsRequestIdRef.current = { ...latestBulletsRequestIdRef.current, [clickedExperienceEntryId]: reqCtx.requestId };
    latestBulletsContextKeyRef.current = {
      ...latestBulletsContextKeyRef.current,
      [clickedExperienceEntryId]: requestContext.key,
    };
    const countBefore = getProAiUsageCount();

    // Freeze the live textarea first — empty live means Generation Mode and must
    // not resurrect generatedDescription/canonical into the payload.
    // Unedited prior AI output: fact authority is pre-AI / original / canonical.
    const textareaProvenance = resolveExperienceTextareaProvenance({
      ...exp,
      description: liveDescription,
    });
    const authoritative = resolveExperienceAiAuthoritativeSource({
      ...exp,
      description: liveDescription,
    });
    const operationSnapshot = createExperienceAiOperationSnapshot({
      liveText: liveDescription,
      canonicalText: exp.canonicalDescription || '',
      originalText: exp.originalUserDescription || '',
      locale: requestedLocale,
      requestId: reqCtx.requestId,
      jobContextHash: requestContext.key,
      experienceEntryId: clickedExperienceEntryId,
      ...(textareaProvenance.currentTextareaProvenance === 'ai_generated_unedited'
        && textareaProvenance.authoritativeFactText.trim()
        ? {
          authoritativeTextOverride: textareaProvenance.authoritativeFactText,
          provenanceOriginOverride: (
            textareaProvenance.authoritativeFactSourceKind === 'canonical'
              ? 'canonicalDescription'
              : 'originalUserDescription'
          ) as 'canonicalDescription' | 'originalUserDescription',
        }
        : {}),
      visibleComparisonProvenance: textareaProvenance.currentTextareaProvenance,
      visibleComparisonMatchedLastAiOutput: textareaProvenance.lastAiOutputHashMatched,
      visibleComparisonMaterialUserEditDetected: textareaProvenance.materialUserEditDetected,
    });
    const liveSourceEmpty = !operationSnapshot.liveRawText.trim();

    // Authoritative Experience AI source: live user-edited textarea beats stale canonical.
    // Empty live → resolve returns none (generation); never promote historical AI text.
    // Unedited AI → pre-AI snapshot (already resolved above).
    const expFrozen = ensureExperienceAiSourceFrozen(exp);
    const aiGrounding = resolveExperienceAiGrounding(
      expFrozen,
      requestContext,
      freezeExperienceAiDescription,
    );
    const generatedDescriptionPreexisted = Boolean(
      (exp.generatedDescription || '').trim()
      || exp.aiOutputProvenance?.lastAiOutputNormalizedHash
      || textareaProvenance.generatedDescriptionPreexisted,
    );
    const staleGeneratedDescriptionIgnored = liveSourceEmpty
      ? generatedDescriptionPreexisted
      : textareaProvenance.staleGeneratedDescriptionIgnored;
    if (liveSourceEmpty) {
      // Generation Mode: force empty request source + clear shadow grounding.
      aiGrounding.sourceDescription = '';
      aiGrounding.experienceForAi = {
        ...authoritative.experienceForAi,
        description: '',
        originalUserDescription: '',
        canonicalDescription: '',
        generatedDescription: '',
        generationJobContextKey: expFrozen.generationJobContextKey,
        groundingJobContextKey: expFrozen.groundingJobContextKey,
        previousGenerationJobContextKey: expFrozen.previousGenerationJobContextKey,
      };
      aiGrounding.groundingSource = 'genuine_user';
      aiGrounding.staleGeneratedContentExcluded = generatedDescriptionPreexisted
        || Boolean((exp.canonicalDescription || '').trim())
        || aiGrounding.staleGeneratedContentExcluded;
    } else if (!aiGrounding.staleGeneratedContentExcluded && authoritative.text.trim()) {
      aiGrounding.sourceDescription = operationSnapshot.normalizedSourceText || authoritative.text;
      aiGrounding.experienceForAi = {
        ...applyOperationSnapshotToExperience(authoritative.experienceForAi, operationSnapshot),
        generationJobContextKey: expFrozen.generationJobContextKey,
        groundingJobContextKey: expFrozen.groundingJobContextKey,
        previousGenerationJobContextKey: expFrozen.previousGenerationJobContextKey,
      };
      aiGrounding.groundingSource = 'genuine_user';
    }

    // Empty-description guard: require either valid grounding or a position for
    // occupation-aware generation. Never block solely because stale AI duties
    // were excluded after an occupation change.
    if (!aiGrounding.sourceDescription.trim() && !String(exp.position || '').trim()) {
      clearTimeout(timer);
      setGeneratingBulletsId(null);
      toast.error(aiErrorMessage('experience_description_required', locale));
      return;
    }

    const diagSession = new ExperienceAiDiagnosticSession({
      uiLocale: locale,
      requestedLocale,
      contentLocale: operationalContentLocale,
      templateId: String(liveCv.templateId || ''),
      gender: liveCv.personal.gender || '',
      industryNorm: requestContext.industryNorm,
      levelNorm: requestContext.levelNorm,
      jobContextHash: requestContext.key,
      requestId: reqCtx.requestId,
      usageCountBefore: countBefore,
    });
    diagSession.stage('button_pressed', 'ok');
    diagSession.recordLiveExperience(exp, Boolean(exp.isPresent));
    diagSession.recordExperienceEntryTarget({
      experienceEntryId: clickedExperienceEntryId,
      isPresent: Boolean(exp.isPresent),
      arrayIndexAtRequest: liveCv.experience.findIndex((e) => e.id === clickedExperienceEntryId),
    });
    diagSession.recordSourceSelection(
      {
        ...exp,
        description: liveDescription,
      },
      aiGrounding,
      {
        requestedLocale,
        selectedSourceKindHint: liveSourceEmpty
          ? 'jobContext'
          : operationSnapshot.provenanceOrigin === 'originalUserDescription'
            ? 'originalUserDescription'
            : operationSnapshot.provenanceOrigin === 'canonicalDescription'
              ? 'canonicalDescription'
              : operationSnapshot.provenanceOrigin === 'currentTextarea'
                ? 'currentTextarea'
                : authoritative.kind === 'description'
                  ? 'description'
                  : authoritative.kind === 'originalUserDescription'
                    ? 'originalUserDescription'
                    : authoritative.kind === 'canonicalDescription'
                      ? 'canonicalDescription'
                      : 'unknown',
        operationalContentLocale,
        generationSourceKind: liveSourceEmpty ? 'jobContext' : 'liveSource',
        generatedDescriptionPreexisted,
        staleGeneratedDescriptionIgnored,
        factLockReason: liveSourceEmpty
          ? 'generation_mode_empty_live'
          : (aiGrounding.sourceDescription.trim() ? 'non_empty_source' : 'no_source'),
        currentTextareaProvenance: textareaProvenance.currentTextareaProvenance,
        authoritativeFactSourceKind: textareaProvenance.authoritativeFactSourceKind,
        currentTextareaUsedForFactExtraction:
          textareaProvenance.currentTextareaUsedForFactExtraction,
        lastAiOutputHashMatched: textareaProvenance.lastAiOutputHashMatched,
        materialUserEditDetected: textareaProvenance.materialUserEditDetected,
      },
    );
    // Capture immutable build metadata before provenance/preflight/any early return.
    await diagSession.resolveVersions();

    const showExperienceAiRejectToast = (message: string) => {
      if (INTERNAL_AI_RESET_ENABLED) {
        void import('@/components/InternalExperienceAiDiagnosticsPanel').then((mod) => {
          toast.error(message, {
            duration: 20_000,
            action: {
              label: mod.EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL,
              onClick: () => {
                void copyExperienceAiDiagnosticsToClipboard().then((ok) => {
                  toast[ok ? 'success' : 'error'](
                    ok ? mod.EXPERIENCE_AI_COPY_OK : mod.EXPERIENCE_AI_COPY_FAIL,
                  );
                });
              },
            },
          });
        });
      } else {
        toast.error(message);
      }
    };

    /**
     * Provider/API failure is not itself evidence that the visible textarea is
     * invalid. Re-run the complete local no-op gate against the immutable
     * request snapshot before surfacing the provider failure to the user.
     */
    const recoverProviderFailureAsLocalNoOp = (options: {
      httpStatus: number | null;
      attempted: boolean;
      errorCode?: string | null;
    }): boolean => {
      const currentCv = cvRef.current;
      const currentEntry = currentCv.experience.find(
        (entry) => entry.id === clickedExperienceEntryId,
      );
      const currentContext = buildExperienceJobContext({
        position: currentEntry?.position,
        industry,
        locale: requestedLocale,
        level,
      });
      const latestId = latestBulletsRequestIdRef.current[clickedExperienceEntryId];
      const latestContext = latestBulletsContextKeyRef.current[clickedExperienceEntryId];
      const currentText = String(currentEntry?.description || '').trim();
      const requestText = operationSnapshot.visibleComparisonRawText.trim();
      const requestStillCurrent = Boolean(currentEntry)
        && latestId === reqCtx.requestId
        && latestContext === requestContext.key
        && experienceJobContextsMatch(currentContext.key, requestContext.key)
        && fingerprintText(currentText.replace(/\s+/g, ' ').trim())
          === fingerprintText(requestText.replace(/\s+/g, ' ').trim());
      if (!requestStillCurrent || !currentText) return false;

      const finalized = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale,
        gender: currentCv.personal.gender || '',
        cv: currentCv,
        candidate: currentText,
        experienceId: clickedExperienceEntryId,
        industry,
        level,
        jobContext: requestContext,
        operationSnapshot,
        earlyUneditedRerunNoOp: true,
      });
      if (
        finalized.diagnostics?.earlyNoOpPreflightPassed !== true
        || finalized.diagnostics?.semanticNoOpDetected !== true
        || finalized.diagnostics?.finalDecisionKind !== 'semantic_noop'
      ) {
        return false;
      }

      diagSession.recordProviderFailureRecoveredNoOp(finalized, options);
      finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore,
        httpStatus: options.httpStatus,
        error: null,
        responseSource: 'blocked',
      });
      diagSession.recordVisibleApply(false, countBefore);
      diagSession.commit();
      logExperienceAiTrace({
        resultApplied: false,
        rejectedReason: 'experience_ai_noop_after_provider_failure',
        aiUsageIncremented: false,
      });
      toast.error(aiErrorMessage('ai_noop', requestedLocale));
      return true;
    };

    const logExperienceAiTrace = (partial: Partial<ExperienceAiJobContextTrace>) => {
      if (process.env.NODE_ENV === 'production') return;
      const payload: ExperienceAiJobContextTrace = {
        previousContextKey: exp.generationJobContextKey || exp.groundingJobContextKey,
        requestContextKey: requestContext.key,
        normalizedPositionClass: requestContext.positionClass,
        normalizedIndustry: requestContext.industryNorm,
        locale: requestedLocale,
        level: requestContext.levelNorm,
        descriptionOrigin: exp.descriptionOrigin,
        groundingSource: aiGrounding.groundingSource,
        staleGeneratedContentExcluded: aiGrounding.staleGeneratedContentExcluded,
        semanticDutyKeysBefore: aiGrounding.semanticDutyKeysBefore,
        semanticDutyKeysUsed: aiGrounding.semanticDutyKeysUsed,
        requestIdMatch: true,
        contextMatch: true,
        resultApplied: false,
        aiUsageIncremented: false,
        ...partial,
      };
      console.info('[ExperienceAIJobContext]', payload);
    };

    try {
      if (
        expFrozen.originalUserDescription !== exp.originalUserDescription
        || expFrozen.canonicalDescription !== exp.canonicalDescription
        || expFrozen.descriptionOrigin !== exp.descriptionOrigin
      ) {
        commitCvUpdate((prev) => ({
          ...prev,
          experience: prev.experience.map((e) =>
            e.id === clickedExperienceEntryId ? ensureCanonicalExperienceFrozen(e) : e,
          ),
        }));
      }
      // AAB-317: unedited valid AI output → early no-op before provider.
      const factAuthorityForPreflight = resolveExperienceFactAuthorityText({
        textareaProvenance,
        snapshot: operationSnapshot,
        groundingSourceDescription: aiGrounding.sourceDescription,
      });
      const sourceBundleForPreflight = buildExperienceOperationSourceBundle({
        textareaProvenance,
        snapshot: operationSnapshot,
        factAuthorityText: factAuthorityForPreflight,
        visibleSourceText: liveDescription,
        locale: requestedLocale,
        isPresent: Boolean(exp.isPresent),
        experienceEntryId: clickedExperienceEntryId,
        jobContextHash: requestContext.key,
        exp: { ...exp, description: liveDescription },
      });
      const visibleAnalysisForPreflight = analyzeExperienceVisibleSource({
        visibleText: liveDescription,
        targetLocale: requestedLocale,
        isPresent: Boolean(exp.isPresent),
        // An unedited output that still matches its write-time provenance has
        // stronger locale authority than a stale document-level contentLocale.
        // Edited/wrong-entry/changed-target text receives no override.
        trustedLocale: resolveTrustedUneditedAiOutputLocale({
          exp,
          provenance: textareaProvenance,
          requestedLocale,
        }),
        generatedLocale: (exp as WorkExperience & { generatedLocale?: string })?.generatedLocale
          || null,
        storedLocale: operationalContentLocale || requestedLocale,
      });
      const visibleCoverageForPreflight = validateVisibleExperienceCoverage({
        sourceDescription: factAuthorityForPreflight,
        visibleText: liveDescription,
        targetLocale: requestedLocale,
        finalNormalizedHash: fingerprintText(
          liveDescription.replace(/\s+/g, ' ').trim(),
        ),
        isPresent: Boolean(exp.isPresent),
      });
      const independentVisibleValidationPassed =
        visibleCoverageForPreflight.visibleFactCoveragePassed
        && (!visibleCoverageForPreflight.visiblePredicateValidationApplicable
          || visibleCoverageForPreflight.visiblePredicateCoveragePassed)
        && visibleCoverageForPreflight.visibleLocaleValidationPassed
        && visibleCoverageForPreflight.visiblePerspectiveValidationPassed
        && visibleCoverageForPreflight.visibleNativeMorphologyValidationPassed
        && (requestedLocale !== 'es'
          || visibleAnalysisForPreflight.sourceTenseValidationPassed === true);
      const earlyNoOp = evaluateUneditedRerunEarlyNoOpPreflight({
        bundle: sourceBundleForPreflight,
        visibleSourceAnalysis: visibleAnalysisForPreflight,
        sourceWasEmpty: liveSourceEmpty,
        raceOrStaleDetected: false,
        independentVisibleValidationPassed,
      });
      if (earlyNoOp.earlyNoOpPreflightPassed) {
        clearTimeout(timer);
        const terminalSnapshot = buildExperienceRequestTimeCleanNoOpSnapshot({
          sourceBundle: sourceBundleForPreflight,
          preflight: earlyNoOp,
          visibleAuthority: visibleAnalysisForPreflight,
          visibleCoverage: visibleCoverageForPreflight,
          requestedLocale,
          entryGeneratedLocaleBeforeApply:
            (exp as WorkExperience & { generatedLocale?: string }).generatedLocale || null,
          contentLocaleDocument: liveCv.contentLocale || null,
        });
        finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: null,
          error: null,
          responseSource: 'blocked',
        });
        diagSession.recordRequestTimeCleanNoOpTerminal(terminalSnapshot);
        // Clean no-op terminalizer already set stages — do not call recordVisibleApply(false).
        await diagSession.resolveVersions();
        diagSession.commit();
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: 'experience_ai_noop',
          aiUsageIncremented: false,
        });
        setGeneratingBulletsId(null);
        toast.error(aiErrorMessage('ai_noop', requestedLocale));
        return;
      }

      diagSession.recordPayloadBuilt({
        locale: requestedLocale,
        industryNorm: requestContext.industryNorm,
        levelNorm: requestContext.levelNorm,
        isPresent: Boolean(exp.isPresent),
      });
      const requestBody = {
        action: 'bullets',
        proToken,
        position: exp.position,
        company: exp.company,
        industry,
        level,
        locale: requestedLocale,
        gender: liveCv.personal.gender || '',
        // Never send stale AI/legacy cooking duties after occupation change.
        sourceDescription: aiGrounding.sourceDescription,
        // Dual-source: fact authority for grounding; visible for rewrite base.
        factAuthorityDescription: factAuthorityForPreflight,
        visibleDescription: liveDescription,
        jobContextKey: requestContext.key,
        // Stable clicked entry ID — authoritative even if array order changes mid-flight.
        experienceEntryId: clickedExperienceEntryId,
        // Structured date status is authoritative for employment tense.
        isPresent: Boolean(exp.isPresent),
        endDate: exp.isPresent ? 'present' : (exp.endDate || ''),
        requestId: reqCtx.requestId,
      };

      const apiResult = await apiFetch<{ result?: string; error?: string; code?: string; retryAfter?: number; repairAttempted?: boolean; fallbackUsed?: boolean; providerPhase?: { candidatePresent?: boolean; requiredFactCount?: number; coveredFactCount?: number; uncoveredSourceIndexes?: number[]; semanticArgumentAdditionCount?: number; addedPredicateCount?: number; addedPredicateIdentityHashes?: string[]; accepted?: boolean } }>('/api/generate', {
        body: requestBody,
        signal: controller.signal,
      });
      let bulletsData = apiResult.data;
      const res = apiResult.response;

      let providerFailureRecovery: { code: string; payload: ReturnType<typeof resolveAiHttpFailure> } | null = null;
      let recoveryAttempted = false;
      let recoveryHttpStatus: number | null = null;
      let recoveryCandidatePresent = false;
      let recoveryCandidateText = '';
      let recoveryAccepted: boolean | null = null;
      let recoverySelected = false;
      let recoveryRejectionReasons: string[] = [];
      let rejectedProviderDiagnostics: Partial<ExperienceAiDiagnosticTrace> | null = null;
      const isRecoverableExperienceValidationReason = (reason: string): boolean => (
        Boolean(reason)
        && !/(?:authorization|forbidden|race|entry[_-]?mismatch|stale|timeout|client_abort|cancel)/i.test(reason)
        && /(?:validation|predicate|fact|coverage|locale|tense|perspective|unsupported|scope|duty|material)/i.test(reason)
      );
      const attemptProviderErrorRecovery = async (reason: string): Promise<void> => {
        if (recoveryAttempted || !isRecoverableExperienceValidationReason(reason)) return;
        recoveryAttempted = true;
        const recoveryPrompt = [
          'EXPERIENCE PROVIDER-ERROR RECOVERY REQUIRED.',
          `Produce a fresh, safe ${requestedLocale} Experience result after the previous provider validation error.`,
          'Use ONLY the immutable SOURCE FACTS below as authority. The previous visible textarea is not a fact source.',
          'Preserve the exact entry identity, employment state, gender/perspective and every source duty.',
          'Preserve material/media, purpose/condition, review/quality and project/team relations exactly where stated.',
          'Do not add tools, systems, metrics, leadership, frequency, universal scope or responsibility escalation.',
          'Return one bullet per source fact, in source order, in the requested locale and employment tense.',
          `Employment state: ${exp.isPresent ? 'current/present' : 'completed/past'}.`,
          cvRef.current.personal.gender
            ? `Gender/perspective: ${cvRef.current.personal.gender}.`
            : '',
          'SOURCE FACTS (immutable):',
          (factAuthorityForPreflight || aiGrounding.sourceDescription).slice(0, 4000),
        ].filter(Boolean).join('\n');
        try {
          const recoveryResult = await apiFetch<{
            result?: string;
            error?: string;
            code?: string;
            repairAttempted?: boolean;
            fallbackUsed?: boolean;
          }>('/api/generate', {
            body: {
              ...requestBody,
              noopRepair: true,
              previousOutput: '',
              repairPromptHint: recoveryPrompt,
            },
            signal: controller.signal,
          });
          recoveryHttpStatus = recoveryResult.response.status;
          recoveryCandidateText = (recoveryResult.data?.result || '').trim();
          recoveryCandidatePresent = Boolean(
            recoveryResult.response.ok
            && recoveryCandidateText
            && !recoveryResult.data?.error,
          );
          if (!recoveryCandidatePresent) {
            recoveryRejectionReasons = [normalizeRecoveryRejectionReason(
              recoveryResult.data,
              recoveryResult.response,
            )];
            recoveryCandidateText = '';
          }
        } catch {
          recoveryRejectionReasons = ['recovery_request_failed'];
          recoveryCandidateText = '';
        }
        if (!recoveryCandidatePresent) {
          recoveryAccepted = false;
          recoverySelected = false;
        }
      };
      if (!res.ok || bulletsData?.error) {
        if (res.status === 403) {
          const payload = resolveAiHttpFailure({ response: res, body: bulletsData });
          const msg = finishAiClientRequest({
            ctx: reqCtx,
            isProVerified: getAiGate().status === 'ready',
            countBefore,
            countAfter: countBefore,
            httpStatus: res.status,
            error: payload,
          });
          diagSession.recordApiResponse({
            httpStatus: res.status,
            errorCode: 'http_403',
          });
          diagSession.recordVisibleApply(false, countBefore);
          diagSession.commit();
          showExperienceAiRejectToast(
            getAiGate().status !== 'free' ? (msg ?? t.common.proAuthorizationUnavailable) : t.common.proAccessRequired,
          );
          logExperienceAiTrace({
            resultApplied: false,
            rejectedReason: 'http_403',
            aiUsageIncremented: false,
          });
          return;
        }
        const payload = resolveAiHttpFailure({ response: res, body: bulletsData });
        if (recoverProviderFailureAsLocalNoOp({
          httpStatus: res.status,
          attempted: true,
          errorCode: payload.code || 'provider_http_failure',
        })) {
          return;
        }
        // A provider/validation error is not itself a terminal product result.
        // Continue through the exact same immutable-source finalizer used for
        // rejected provider candidates. It will select a safe cross-locale or
        // deterministic fallback only when every existing gate passes.
        providerFailureRecovery = {
          code: payload.code || 'provider_http_failure',
          payload,
        };
        const recoverableValidationFailure = res.status === 422
          || /(?:generation|provider).*validation|validation_failed/i.test(
            payload.code || '',
          );
        if (recoverableValidationFailure) {
          await attemptProviderErrorRecovery(payload.code || 'provider_validation_failed');
        }
        bulletsData = {
          ...(bulletsData || {}),
          result: recoveryCandidateText,
          error: recoveryCandidateText ? undefined : (payload.code || 'provider_http_failure'),
          repairAttempted: Boolean(recoveryCandidateText),
          fallbackUsed: false,
        };
        diagSession.patch({
          recoveryAttempted,
          recoveryHttpStatus,
          recoveryCandidatePresent,
          recoveryAccepted,
          recoveryRejectionReasons,
          recoverySelected,
          ...recoveryCandidateMetadata(recoveryCandidateText),
        });
      }

      // Stale-response guard: requestId + job-context must both still match.
      const latestId = latestBulletsRequestIdRef.current[clickedExperienceEntryId];
      const latestCtx = latestBulletsContextKeyRef.current[clickedExperienceEntryId];
      const liveNow = cvRef.current;
      const expNow = liveNow.experience.find((e) => e.id === clickedExperienceEntryId);
      const liveContext = buildExperienceJobContext({
        position: expNow?.position,
        industry: expIndustry[clickedExperienceEntryId] ?? industry,
        locale,
        level: expLevel[clickedExperienceEntryId] ?? level,
      });
      diagSession.recordApiResponse({
        httpStatus: res.status,
        repairAttempted: Boolean(bulletsData.repairAttempted),
        fallbackUsed: Boolean(bulletsData.fallbackUsed),
        resultText: bulletsData.result || '',
        errorCode: providerFailureRecovery?.code,
      });
      if (
        latestId !== reqCtx.requestId
        || latestCtx !== requestContext.key
        || !experienceJobContextsMatch(liveContext.key, requestContext.key)
      ) {
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'bullets_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_request_superseded',
        });
        diagSession.recordRaceCheck(false, 'stale_request_or_context_mismatch', liveContext.key);
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: 'stale_request_or_context_mismatch',
          requestIdMatch: latestId === reqCtx.requestId,
          contextMatch: experienceJobContextsMatch(liveContext.key, requestContext.key),
          aiUsageIncremented: false,
        });
        return;
      }
      diagSession.recordRaceCheck(true, undefined, liveContext.key);
      const newDescription = providerFailureRecovery
        ? recoveryCandidateText
        : (bulletsData.result || '');
      const finalizeInputBase = {
        action: 'experience_bullets' as const,
        field: 'experience_description' as const,
        requestedLocale,
        gender: liveNow.personal.gender || '',
        cv: {
          ...liveNow,
          experience: liveNow.experience.map((e) =>
            e.id === clickedExperienceEntryId ? aiGrounding.experienceForAi : e,
          ),
        },
        experienceId: clickedExperienceEntryId,
        industry,
        level,
        jobContext: requestContext,
        operationSnapshot,
        providerPhaseDiagnostics: bulletsData.providerPhase,
      };
      let finalizedBullets = finalizeCvAiFieldForApply({
        ...finalizeInputBase,
        candidate: newDescription,
        originHint: providerFailureRecovery
          ? 'ai_repaired'
          : bulletsData.fallbackUsed
          ? 'deterministic_fallback'
          : bulletsData.repairAttempted
            ? 'ai_repaired'
            : 'ai_generated',
      });
      if (!providerFailureRecovery && !finalizedBullets.countedAsSuccess) {
        const candidateDiagnostics = (finalizedBullets.diagnostics || {}) as Partial<ExperienceAiDiagnosticTrace>;
        const candidateDiagnosticsUnknown = candidateDiagnostics as Record<string, unknown>;
        rejectedProviderDiagnostics = candidateDiagnostics;
        const providerReason = String(
          candidateDiagnosticsUnknown.providerRejectionReason
          || (Array.isArray(candidateDiagnostics.providerRejectionReasons)
            ? candidateDiagnostics.providerRejectionReasons[0]
            : '')
          || finalizedBullets.reason
          || candidateDiagnosticsUnknown.typedFailureReason
          || '',
        );
        // A parsed HTTP-200 provider candidate can fail the same typed
        // validation gates as a transport/422 response. Route only those
        // recoverable validation failures through the bounded server repair;
        // authorization, races, timeouts and entry mismatches remain terminal.
        if (isRecoverableExperienceValidationReason(providerReason)) {
          providerFailureRecovery = {
            code: providerReason,
            payload: resolveAiHttpFailure({
              response: res,
              body: { code: providerReason },
            }),
          };
          await attemptProviderErrorRecovery(providerReason);
          bulletsData = {
            ...(bulletsData || {}),
            result: recoveryCandidateText,
            repairAttempted: Boolean(recoveryCandidateText),
            fallbackUsed: false,
          };
          if (recoveryCandidatePresent) {
            finalizedBullets = finalizeCvAiFieldForApply({
              ...finalizeInputBase,
              candidate: recoveryCandidateText,
              originHint: 'ai_repaired',
            });
          }
        }
      }
      if (providerFailureRecovery && recoveryCandidatePresent) {
        const finalizerAccepted = Boolean(
          finalizedBullets.countedAsSuccess && !finalizedBullets.blocked,
        );
        recoveryAccepted = finalizerAccepted;
        recoverySelected = finalizerAccepted;
        if (!finalizerAccepted) {
          recoveryRejectionReasons = [
            ...recoveryRejectionReasons,
            finalizedBullets.reason
              || finalizedBullets.diagnostics?.typedFailureReason
              || 'recovery_candidate_rejected',
          ];
        }
        diagSession.patch({
          recoveryAccepted,
          recoverySelected,
          recoveryRejectionReasons,
          finalCandidateSource: finalizerAccepted
            ? 'server_repair'
            : 'none',
        });
      }
      const providerPhaseFields = rejectedProviderDiagnostics
        ? {
          providerResponseKind: 'provider' as const,
          apiResponseKind: 'provider' as const,
          providerAccepted: false,
          providerPrimaryCandidateValidationAccepted: false,
          providerValidationApplicable:
            rejectedProviderDiagnostics.providerValidationApplicable ?? true,
          providerBulletCount: rejectedProviderDiagnostics.providerBulletCount ?? null,
          providerRequiredFactCount: rejectedProviderDiagnostics.providerRequiredFactCount ?? null,
          providerCoveredFactCount: rejectedProviderDiagnostics.providerCoveredFactCount ?? null,
          providerUncoveredFactCount: rejectedProviderDiagnostics.providerUncoveredFactCount ?? null,
          providerUncoveredFactIdentityHashes:
            Array.isArray(rejectedProviderDiagnostics.providerUncoveredFactIdentityHashes)
              ? rejectedProviderDiagnostics.providerUncoveredFactIdentityHashes.map(String)
              : [],
          providerPredicateValidationApplicable:
            rejectedProviderDiagnostics.providerPredicateValidationApplicable ?? null,
          providerSourceUnitPredicateCoveragePassed:
            rejectedProviderDiagnostics.providerSourceUnitPredicateCoveragePassed ?? null,
          providerLocalePurityPassed: rejectedProviderDiagnostics.providerLocalePurityPassed ?? null,
          providerSemanticCoveragePassed: rejectedProviderDiagnostics.providerSemanticCoveragePassed ?? null,
          providerCoverageCount: rejectedProviderDiagnostics.providerCoverageCount ?? null,
          providerRejectionReasons:
            Array.isArray(rejectedProviderDiagnostics.providerRejectionReasons)
              ? rejectedProviderDiagnostics.providerRejectionReasons.map(String)
              : [providerFailureRecovery?.code || 'provider_validation_failed'],
          providerRejectionStage:
            String(rejectedProviderDiagnostics.providerRejectionStage || 'provider_validation'),
        }
        : {
          providerResponseKind: 'error' as const,
          apiResponseKind: 'error' as const,
          providerAccepted: false,
          providerPrimaryCandidateValidationAccepted: null,
          providerValidationApplicable: null,
          providerBulletCount: null,
          providerRequiredFactCount: null,
          providerCoveredFactCount: null,
          providerUncoveredFactCount: null,
          providerUncoveredFactIdentityHashes: [],
          providerPredicateValidationApplicable: null,
          providerSourceUnitPredicateCoveragePassed: null,
          providerLocalePurityPassed: null,
          providerSemanticCoveragePassed: null,
          providerCoverageCount: null,
          providerRejectionReasons: [providerFailureRecovery?.code || 'provider_http_failure'],
          providerRejectionStage: 'api_response_received',
        };
      if (providerFailureRecovery) {
        diagSession.patch({
          providerHttpStatus: res.status,
          providerAttempted: true,
          ...providerPhaseFields,
          clientDeterministicFallbackReason:
            finalizedBullets.diagnostics?.clientDeterministicFallbackReason
            || 'provider_validation_error_recovery',
          recoveryAttempted,
          recoveryHttpStatus,
          recoveryCandidatePresent,
          recoveryAccepted,
          recoveryRejectionReasons,
          recoverySelected,
        });
      }

      // Recoverable provider echo: one dedicated no-op repair, then deterministic fallback.
      let noOpRepairAttempted = false;
      let noOpRepairHttpStatus: number | null = null;
      if (!providerFailureRecovery && isRecoverableExperienceProviderNoOp(finalizedBullets)) {
        diagSession.patch({
          providerNoOpDetected: true,
          noOpRejected: true,
        });
        noOpRepairAttempted = true;
        diagSession.patch({ noOpRepairAttempted: true });
        try {
          const repairPrompt = buildExperienceAiNoOpRepairPrompt({
            locale: requestedLocale,
            sourceDescription: aiGrounding.sourceDescription || liveDescription,
            previousOutput: newDescription,
            isPresent: Boolean(exp.isPresent),
            gender: liveNow.personal.gender || '',
            industry,
            level,
            position: exp.position,
          });
          const { data: repairData, response: repairRes } = await apiFetch<{
            result?: string;
            error?: string;
            code?: string;
            repairAttempted?: boolean;
            fallbackUsed?: boolean;
          }>('/api/generate', {
            body: {
              ...requestBody,
              noopRepair: true,
              previousOutput: newDescription,
              repairPromptHint: repairPrompt,
            },
            signal: controller.signal,
          });
          noOpRepairHttpStatus = repairRes.status;
          diagSession.patch({ noOpRepairHttpStatus });
          const repairText = (repairData?.result || '').trim();
          if (repairRes.ok && repairText && !repairData?.error) {
            finalizedBullets = finalizeCvAiFieldForApply({
              ...finalizeInputBase,
              candidate: repairText,
              noOpRepairAttempted: true,
              originHint: 'ai_repaired',
            });
          } else {
            finalizedBullets = finalizeCvAiFieldForApply({
              ...finalizeInputBase,
              candidate: newDescription,
              noOpRepairAttempted: true,
              originHint: bulletsData.fallbackUsed
                ? 'deterministic_fallback'
                : 'ai_generated',
            });
          }
        } catch {
          finalizedBullets = finalizeCvAiFieldForApply({
            ...finalizeInputBase,
            candidate: newDescription,
            noOpRepairAttempted: true,
            originHint: 'ai_generated',
          });
        }
        diagSession.patch({
          noOpRepairAttempted: true,
          noOpRepairHttpStatus,
          noOpRepairApplied: Boolean(finalizedBullets.diagnostics?.noOpRepairApplied),
          noOpRepairValidationPassed:
            finalizedBullets.diagnostics?.noOpRepairValidationPassed ?? null,
          noOpRepairMeaningfulChangeDetected:
            finalizedBullets.diagnostics?.noOpRepairMeaningfulChangeDetected ?? null,
          deterministicFallbackAttemptedAfterNoOp: Boolean(
            finalizedBullets.diagnostics?.deterministicFallbackAttemptedAfterNoOp,
          ),
          deterministicFallbackAppliedAfterNoOp: Boolean(
            finalizedBullets.diagnostics?.deterministicFallbackAppliedAfterNoOp,
          ),
          finalCandidateSource:
            (finalizedBullets.diagnostics?.finalCandidateSource as string | undefined) || null,
        });
      }

      diagSession.recordFinalizeResult(finalizedBullets);
      if (providerFailureRecovery) {
        // recordFinalizeResult intentionally mirrors any provider-candidate
        // fields exposed by the finalizer. For an HTTP/validation terminal,
        // however, no provider candidate was evaluated: keep those fields
        // explicitly N/A and preserve the actual local fallback evidence. A
        // parsed HTTP-200 candidate has evaluated provider fields instead.
        diagSession.patch({
          providerHttpStatus: res.status,
          providerAttempted: true,
          ...providerPhaseFields,
          clientDeterministicFallbackReason:
            finalizedBullets.diagnostics?.clientDeterministicFallbackReason
            || 'provider_validation_error_recovery',
          recoveryAttempted,
          recoveryHttpStatus,
          recoveryCandidatePresent,
          recoveryAccepted,
          recoveryRejectionReasons,
          recoverySelected,
          finalCandidateSource: recoveryAccepted
            ? 'server_repair'
            : 'none',
        });
      }
      // Re-assert stable clicked entry targeting after finalize (never inherit prior card).
      diagSession.recordExperienceEntryTarget({
        experienceEntryId: clickedExperienceEntryId,
        isPresent: Boolean(exp.isPresent),
        arrayIndexAtRequest: liveNow.experience.findIndex((e) => e.id === clickedExperienceEntryId),
      });
      if (finalizedBullets.countedAsSuccess) {
        const preApplyGate = diagSession.evaluatePreApplyDecisionGates();
        if (!preApplyGate.passed) {
          const failCode = mapExperienceAiFailureToErrorCode(
            preApplyGate.reason || 'diagnostic_invariant_failed',
          );
          const msg = finishAiClientRequest({
            ctx: reqCtx,
            isProVerified: true,
            countBefore,
            countAfter: countBefore,
            httpStatus: res.status,
            error: { code: failCode, httpStatus: 422 },
            responseSource: 'blocked',
          });
          logExperienceAiTrace({
            resultApplied: false,
            rejectedReason: preApplyGate.reason || 'diagnostic_invariant_failed',
            aiUsageIncremented: false,
            ...(finalizedBullets.diagnostics || {}),
          });
          diagSession.recordVisibleApply(false, countBefore);
          diagSession.commit();
          showExperienceAiRejectToast(msg ?? aiErrorMessage(failCode, locale));
          return;
        }
      }
      if (
        finalizedBullets.countedAsSuccess
        && candidateConflictsWithJobContext(finalizedBullets.text, requestContext)
        && aiGrounding.staleGeneratedContentExcluded
      ) {
        // Hard reject cooking survival under pharmacist context.
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'generation_validation_failed', httpStatus: 422 },
          responseSource: 'blocked',
        });
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: 'cooking_duties_under_pharmacist',
          aiUsageIncremented: false,
        });
        diagSession.patch({
          finalTypedFailureReason: 'cooking_duties_under_pharmacist',
          rejectionStage: 'final_apply_postcondition',
        });
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        showExperienceAiRejectToast(msg ?? aiErrorMessage('generation_validation_failed', locale));
        return;
      }
      if (finalizedBullets.blocked || !finalizedBullets.countedAsSuccess) {
        const failCode = mapExperienceAiFailureToErrorCode(
          finalizedBullets.reason || finalizedBullets.diagnostics?.typedFailureReason,
        );
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'bullets_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: finalizedBullets.reason || failCode,
        });
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: finalizedBullets.reason || failCode,
          aiUsageIncremented: false,
          ...(finalizedBullets.diagnostics || {}),
        });
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        showExperienceAiRejectToast(msg ?? aiErrorMessage(failCode, locale));
        return;
      }

      // AAB-329: transactional temporary write → independent visible validation → commit/rollback.
      void EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION;
      void EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION;
      const previousTargetEntry = (cvRef.current.experience || []).find(
        (e) => e.id === clickedExperienceEntryId,
      );
      const previousTargetText = String(
        previousTargetEntry?.description
        || exp.description
        || '',
      );
      const finalNormalizedHash = String(
        finalizedBullets.diagnostics?.finalNormalizedHash
        || fingerprintText((finalizedBullets.text || '').replace(/\s+/g, ' ').trim()),
      );
      const authoritativeSourceForVisible = String(
        aiGrounding.sourceDescription || previousTargetText,
      );
      let currentVisibleTextAtWrite = String(previousTargetEntry?.description || '');
      if (typeof document !== 'undefined') {
        const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(clickedExperienceEntryId)
          : clickedExperienceEntryId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const domField = document.querySelector(
          `[data-experience-description-id="${escapedId}"]`,
        ) as HTMLTextAreaElement | null;
        if (domField && typeof domField.value === 'string') {
          currentVisibleTextAtWrite = domField.value;
        }
      }
      diagSession.patch({
        applyAuthorized: true,
        applyAttempted: true,
        attemptedApplyExperienceEntryIdHash:
          (finalizedBullets.diagnostics?.selectedExperienceEntryIdHash as string | undefined)
          || (finalizedBullets.diagnostics?.attemptedApplyExperienceEntryIdHash as string | undefined)
          || null,
        attemptedApplyEmploymentState: exp.isPresent ? 'current' : 'completed',
        attemptedApplyCandidateHash: finalNormalizedHash,
        entryGeneratedLocaleBeforeApply:
          (finalizedBullets.diagnostics?.entryGeneratedLocaleBeforeApply as string | undefined)
          || (previousTargetEntry as { generatedLocale?: string } | undefined)?.generatedLocale
          || null,
        visibleTextareaLocaleBeforeApply:
          (finalizedBullets.diagnostics?.visibleTextareaLocaleBeforeApply as string | undefined)
          || (finalizedBullets.diagnostics?.visibleTextareaLocale as string | undefined)
          || null,
      });
      const applyTransaction = commitExperienceApplyTransactionally({
        cvRef,
        ownership: experienceApplyOwnershipRef.current,
        locale: requestedLocale,
        experienceId: clickedExperienceEntryId,
        finalized: finalizedBullets,
        operationSourceText: operationSnapshot.visibleComparisonRawText,
        currentVisibleText: currentVisibleTextAtWrite,
        operationId: reqCtx.requestId,
        jobContext: requestContext,
        scheduleReactCv: (next) => setCv(next),
      });
      diagSession.patch({
        experienceApplyOperationSourceHash: applyTransaction.lifecycle.operationSourceHash,
        experienceApplySelectedFinalHash: applyTransaction.lifecycle.selectedFinalHash,
        experienceApplyCvRefHashBeforeWrite: applyTransaction.lifecycle.cvRefHashBeforeWrite,
        experienceApplyFormHashBeforeWrite: applyTransaction.lifecycle.formHashBeforeWrite,
        experienceApplyTransactionWrittenHash: applyTransaction.lifecycle.transactionWrittenHash,
        experienceApplyCvRefHashImmediatelyAfterWrite:
          applyTransaction.lifecycle.cvRefHashImmediatelyAfterWrite,
        experienceApplyTransactionEntryIdHash:
          applyTransaction.lifecycle.transactionEntryIdHash,
        experienceApplyOperationIdHash: applyTransaction.lifecycle.operationIdHash,
        experienceApplyOwnershipPassed: applyTransaction.lifecycle.applyOwnershipPassed,
        experienceApplyActualRaceDetected: applyTransaction.lifecycle.actualRaceDetected,
        experienceApplyActualRaceReason: applyTransaction.lifecycle.actualRaceReason,
        experienceApplyPostWriteReadSource: applyTransaction.lifecycle.postWriteReadSource,
        experienceApplyFailureKind: applyTransaction.lifecycle.failureKind,
      });
      diagSession.stage(
        'temporary_visible_write',
        applyTransaction.ok ? 'ok' : 'fail',
        applyTransaction.lifecycle.failureKind === 'none'
          ? undefined
          : applyTransaction.lifecycle.failureKind,
      );

      if (applyTransaction.lifecycle.actualRaceDetected) {
        diagSession.patch({
          applyWriteSucceeded: false,
          visibleValidationAttempted: false,
          visibleValidationPassed: false,
          rollbackAttempted: false,
          rollbackSucceeded: null,
          applyCommitted: false,
          targetContentApplied: false,
          contentLocaleUpdatedAfterApply: false,
          translationFallbackApplied: false,
          appliedVisibleContentLocale: null,
          appliedExperienceEntryIdHash: null,
          countedAsSuccess: false,
          finalTypedFailureReason: 'stale_experience_edited_in_flight',
          rejectionStage: 'compare_and_swap_source',
        });
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'generation_validation_failed', httpStatus: 422 },
          responseSource: 'blocked',
        });
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: 'stale_experience_edited_in_flight',
          aiUsageIncremented: false,
        });
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        showExperienceAiRejectToast(msg ?? aiErrorMessage('generation_validation_failed', locale));
        return;
      }

      const transactionWrittenCv = applyTransaction.writtenCv;
      const visibleEntry = (transactionWrittenCv?.experience || []).find(
        (e) => e.id === clickedExperienceEntryId,
      );
      const visibleText = String(applyTransaction.writtenDescription || '');
      const writeSucceeded = applyTransaction.ok
        && Boolean(visibleText.trim())
        && visibleText.trim() === (finalizedBullets.text || '').trim();
      diagSession.patch({
        applyWriteSucceeded: writeSucceeded,
        visibleValidationAttempted: true,
      });
      const visibleCov = validateVisibleExperienceCoverage({
        sourceDescription: authoritativeSourceForVisible || previousTargetText,
        visibleText,
        targetLocale: requestedLocale,
        finalNormalizedHash,
        isPresent: Boolean(exp.isPresent),
      });
      const visibleEntryStillExists = Boolean(visibleEntry);
      const visiblePerspectiveReason = visibleCov.visiblePersonMode === 'first_singular'
        ? 'experience_cv_perspective_first_person'
        : 'experience_cv_perspective_unproven';
      const visibleAppliedEntryIdHash = visibleEntryStillExists
        ? String(
          finalizedBullets.diagnostics?.selectedExperienceEntryIdHash
          || applyTransaction.lifecycle.transactionEntryIdHash,
        )
        : null;
      const visibleOk = writeSucceeded
        && visibleCov.visibleDescriptionMatchesFinalHash
        && visibleCov.visibleLocaleValidationPassed
        && visibleCov.visiblePerspectiveValidationPassed
        && (
          !visibleCov.visiblePredicateValidationApplicable
          || (
            visibleCov.visibleFactCoveragePassed
            && visibleCov.visiblePredicateCoveragePassed
          )
        )
        && visibleEntryStillExists;
      diagSession.patch({
        ...visibleCov,
        visibleAppliedEntryIdHash,
        visibleTenseValidationPassed:
          finalizedBullets.diagnostics?.tenseValidationPassed !== false,
        visibleValidationPassed: visibleOk,
        visibleTextareaMatchesFinalNormalizedHash:
          visibleCov.visibleDescriptionMatchesFinalHash,
        visibleDescriptionMatchesFinalHash: visibleCov.visibleDescriptionMatchesFinalHash,
      });
      diagSession.stage(
        'visible_fact_validation',
        visibleCov.visibleFactCoveragePassed || !visibleCov.visiblePredicateValidationApplicable
          ? 'ok'
          : 'fail',
      );
      diagSession.stage(
        'visible_predicate_validation',
        visibleCov.visiblePredicateCoveragePassed || !visibleCov.visiblePredicateValidationApplicable
          ? 'ok'
          : 'fail',
      );
      diagSession.stage(
        'visible_locale_validation',
        visibleCov.visibleLocaleValidationPassed ? 'ok' : 'fail',
      );
      diagSession.stage(
        'visible_tense_validation',
        finalizedBullets.diagnostics?.tenseValidationPassed !== false ? 'ok' : 'fail',
      );
      diagSession.stage(
        'visible_perspective_validation',
        visibleCov.visiblePerspectiveValidationPassed ? 'ok' : 'fail',
        visibleCov.visiblePerspectiveValidationPassed
          ? undefined
          : visiblePerspectiveReason,
      );
      diagSession.stage(
        'visible_hash_validation',
        visibleCov.visibleDescriptionMatchesFinalHash ? 'ok' : 'fail',
      );

      if (!visibleOk) {
        const actualWriteFailure = !applyTransaction.ok;
        diagSession.patch({
          rollbackAttempted: true,
          applyCommitted: false,
          targetContentApplied: false,
          contentLocaleUpdatedAfterApply: false,
          translationFallbackApplied: false,
          appliedVisibleContentLocale: null,
          appliedExperienceEntryIdHash: null,
          countedAsSuccess: false,
          finalTypedFailureReason: actualWriteFailure
            ? 'visible_apply_write_failed'
            : (!visibleCov.visiblePerspectiveValidationPassed
              ? visiblePerspectiveReason
              : 'visible_apply_validation_failed'),
          rejectionStage: !visibleCov.visiblePerspectiveValidationPassed
            ? 'visible_apply:perspective'
            : 'visible_apply',
        });
        diagSession.stage('rollback_started', 'ok');
        const rollbackOk = rollbackExperienceApplyTransactionally({
          cvRef,
          ownership: experienceApplyOwnershipRef.current,
          experienceId: clickedExperienceEntryId,
          previousCv: applyTransaction.previousCv,
          scheduleReactCv: (next) => setCv(next),
        });
        diagSession.patch({
          rollbackSucceeded: rollbackOk,
          applyCommitted: false,
          targetContentApplied: false,
          translationFallbackApplied: false,
          appliedVisibleContentLocale: null,
          appliedExperienceEntryIdHash: null,
        });
        diagSession.stage('rollback_completed', rollbackOk ? 'ok' : 'fail');
        if (!rollbackOk) {
          diagSession.patch({
            finalTypedFailureReason: 'visible_apply_rollback_failed',
          });
        }
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'generation_validation_failed', httpStatus: 422 },
          responseSource: 'blocked',
        });
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: actualWriteFailure
            ? 'visible_apply_write_failed'
            : 'visible_apply_validation_failed',
          aiUsageIncremented: false,
        });
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        showExperienceAiRejectToast(msg ?? aiErrorMessage('generation_validation_failed', locale));
        return;
      }

      // Re-read committed entry — post-apply locale truth from stored state.
      // Public appliedVisibleContentLocale must be canonical (pt-BR), never a
      // lowercased comparison key (pt-br). Raw persisted value stays separate.
      const committedEntry = (cvRef.current.experience || []).find(
        (e) => e.id === clickedExperienceEntryId,
      );
      const appliedLocaleResolved = resolveCommittedAppliedVisibleContentLocale({
        persistedGeneratedLocale:
          (committedEntry as { generatedLocale?: string } | undefined)?.generatedLocale
          || null,
        requestedTargetLocale: requestedLocale,
      });
      const persistedAppliedLocale = appliedLocaleResolved.appliedVisibleContentLocale;
      const contentLocaleCanonical = String(
        canonicalizeContentLocale(
          transactionWrittenCv?.contentLocale || cvRef.current.contentLocale || requestedLocale,
        ),
      );
      diagSession.patch({
        applyCommitted: true,
        targetContentApplied: true,
        contentLocaleUpdatedAfterApply: true,
        appliedVisibleContentLocale: persistedAppliedLocale,
        appliedVisibleContentLocaleRaw:
          appliedLocaleResolved.appliedVisibleContentLocaleRaw,
        contentLocaleDocument: contentLocaleCanonical,
        appliedExperienceEntryIdHash:
          (finalizedBullets.diagnostics?.selectedExperienceEntryIdHash as string | undefined)
          || null,
        appliedEmploymentState: exp.isPresent ? 'current' : 'completed',
        appliedFinalBulletCount:
          Number(finalizedBullets.diagnostics?.finalBulletCount
            ?? finalizedBullets.diagnostics?.finalCandidateBulletCount
            ?? 0) || undefined,
        appliedFinalBulletScripts:
          (finalizedBullets.diagnostics?.finalBulletScripts as string[] | undefined)
          || (finalizedBullets.diagnostics?.finalCandidateBulletScripts as string[] | undefined)
          || [],
        rollbackAttempted: false,
        rollbackSucceeded: null,
        postapplyDiagnosticCompletenessPassed: true,
        postapplyDiagnosticInvariantCheckPassed: true,
        diagnosticCompletenessPassed: true,
        diagnosticInvariantCheckPassed: true,
      });
      diagSession.stage('postapply_invariant_gate', 'ok');
      diagSession.stage('postapply_completeness_gate', 'ok');
      diagSession.stage('apply_committed', 'ok');

      recordProAiSuccess();
      finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore + 1,
        httpStatus: res.status,
        error: null,
        automaticRepairCount: (bulletsData.repairAttempted ? 1 : 0) + (noOpRepairAttempted ? 1 : 0),
        fallbackUsed: Boolean(bulletsData.fallbackUsed)
          || finalizedBullets.origin === 'deterministic_fallback',
        responseSource: finalizedBullets.origin === 'deterministic_fallback'
          || bulletsData.fallbackUsed
          || finalizedBullets.diagnostics?.deterministicFallbackAppliedAfterNoOp
          ? 'deterministic_fallback'
          : (finalizedBullets.diagnostics?.noOpRepairApplied || bulletsData.repairAttempted)
            ? 'repair'
            : 'provider',
      });
      logAiLocaleTransitionDiagnostics({
        requestId: reqCtx.requestId,
        action: 'bullets_generate',
        uiLocale: locale,
        requestedLocale,
        previousContentLocale,
        apiLocale: requestedLocale,
        finalValidationLocale: requestedLocale,
        applied: true,
        newContentLocale: requestedLocale,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'bullets_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: false,
        applied: true,
      });
      const experienceTraceDiagnostics = providerFailureRecovery
        ? {
          ...(finalizedBullets.diagnostics || {}),
          // The primary provider response remains rejected; recovery evidence
          // is local/server-repair provenance and must not be serialized as
          // provider acceptance.
          ...providerPhaseFields,
        }
        : finalizedBullets.diagnostics;
      logExperienceAiTrace({
        appliedContextKey: requestContext.key,
        resultApplied: true,
        aiUsageIncremented: true,
        semanticDutyKeysUsed: [],
        ...(experienceTraceDiagnostics || {}),
      });
      diagSession.recordVisibleApply(true, countBefore + 1, {
        visibleDescription: visibleText,
        finalNormalizedText: finalizedBullets.text,
      });
      if (providerFailureRecovery) {
        // recordVisibleApply derives provider-phase acceptance from the
        // selected final candidate. Reassert that the primary response itself
        // was rejected; only the bounded recovery was selected.
        diagSession.patch({
          ...providerPhaseFields,
        });
      }
      diagSession.commit();
      toast.success(t.cv.bulletsSuccess);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[AI Improvements Error]', err);
      const payload = resolveAiHttpFailure({ response: null, error: err });
      if (recoverProviderFailureAsLocalNoOp({
        httpStatus: null,
        attempted: true,
        errorCode: payload.code || 'provider_request_failed',
      })) {
        return;
      }
      const msg = finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore,
        httpStatus: null,
        error: payload,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'bullets_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: err instanceof Error && err.name === 'AbortError',
        applied: false,
        reason: payload.code,
      });
      logExperienceAiTrace({
        resultApplied: false,
        rejectedReason: payload.code || 'exception',
        aiUsageIncremented: false,
      });
      diagSession.recordApiResponse({
        httpStatus: null,
        errorCode: payload.code || 'exception',
      });
      diagSession.recordVisibleApply(false, countBefore);
      diagSession.commit();
      showExperienceAiRejectToast(
        msg ?? aiErrorMessage(payload.code === 'network_error' ? 'network_error' : 'provider_temporarily_unavailable', locale),
      );
    } finally {
      await terminalizeAiDiagnosticSession(diagSession);
      clearTimeout(timer);
      setGeneratingBulletsId(null);
    }
  };

  const handleRewrite = async (style: 'shorter' | 'stronger' | 'professional') => {
    if (rewritingStyle) return;
    const liveCvAtPress = cvRef.current;
    const liveSummaryAtPress = (liveCvAtPress.summary || '').trim();
    const buttonId = summaryRewriteButtonId(style);
    const operationMode = resolveAiButtonOperationMode(buttonId, liveSummaryAtPress);
    if (
      operationMode === 'generate_from_context'
      && !hasSufficientSummaryGenerationContext(liveCvAtPress)
    ) {
      toast.error(aiErrorMessage('summary_rewrite_failed', locale));
      return;
    }
    const proToken = getCurrentProTokenOrToast(() => setSummaryAiModal(true));
    if (!proToken) return;
    setRewritingStyle(style);
    const controller = new AbortController();
    const clientTimeoutMs = resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS);
    const timer = setTimeout(() => controller.abort(), clientTimeoutMs);
    // Immutable request context — see handleGenSummary for the same pattern.
    const reqCtx = beginAiClientRequest(`rewrite:${style}`, locale);
    const requestedLocale = reqCtx.locale as Locale;
    const previousContentLocale = liveCvAtPress.canonicalSnapshot?.canonicalLocale ?? null;
    latestRewriteRequestIdRef.current = reqCtx.requestId;
    const countBefore = getProAiUsageCount();
    const primaryExpForRewrite = resolveSummaryCurrentRole(liveCvAtPress.experience || []);
    const rewriteJobContext = buildExperienceJobContext({
      position: primaryExpForRewrite?.position || liveCvAtPress.personal?.jobTitle,
      locale: requestedLocale,
    });
    const summaryDiag = new SummaryAiDiagnosticSession({
      uiLocale: locale,
      requestedLocale,
      contentLocale: previousContentLocale || liveCvAtPress.contentLocale || null,
      templateId: String(liveCvAtPress.templateId || ''),
      gender: liveCvAtPress.personal.gender || '',
      requestId: reqCtx.requestId,
      usageCountBefore: countBefore,
      operationMode,
      rewriteStyle: style,
      jobContextHash: rewriteJobContext.key,
    });
    summaryDiag.recordCvSnapshot(liveCvAtPress, liveSummaryAtPress);
    summaryDiag.patch({
      previousSummaryUsedAsFactSource: false,
      rewriteStyle: style,
    });
    try {
      const referenceDateIso = new Date().toISOString().slice(0, 10);
      const durationSnapshot = buildExperienceDurationSnapshot(
        liveCvAtPress.experience,
        referenceDateIso,
      );
      const localization = await resolveSummaryLocalizedManifest({
        cv: liveCvAtPress,
        locale: requestedLocale,
        gender: liveCvAtPress.personal.gender || '',
        referenceDateIso,
        proToken,
        requestId: reqCtx.requestId,
        signal: controller.signal,
      });
      recordSummaryLocalizationDiagnostics(summaryDiag, localization, liveCvAtPress);
      if (!localization.manifest) {
        summaryDiag.stage('localization', 'fail', localization.reason || 'localization_provider_failed');
        summaryDiag.recordPreCandidateTerminalFailure({
          stage: 'localization',
          reason: localization.reason || 'localization_provider_failed',
          usageAfter: countBefore,
          localizationHttpStatus: localization.httpStatus,
          localizationApiResponseKind: localization.apiResponseKind,
          localizationServerFallbackUsed: localization.serverFallbackUsed,
          localizationClientFallbackUsed: localization.clientFallbackUsed,
          serverFallbackUsed: localization.serverFallbackUsed,
          clientFallbackUsed: localization.clientFallbackUsed,
        });
        toast.error(aiErrorMessage('generation_validation_failed', requestedLocale));
        return;
      }
      summaryDiag.stage('localization', 'ok', localization.localizationSource || undefined);
      const localizedExperienceEntries = buildSummaryV2ProviderExperienceEntries({
        manifest: localization.sourceManifest,
        localized: localization.manifest,
      });
      if (!localizedExperienceEntries) {
        summaryDiag.stage('localization', 'fail', 'localized_manifest_projection_failed');
        summaryDiag.recordPreCandidateTerminalFailure({
          stage: 'localization',
          reason: 'localized_manifest_projection_failed',
          usageAfter: countBefore,
          localizationHttpStatus: localization.httpStatus,
          localizationApiResponseKind: 'validation_rejected',
          localizationServerFallbackUsed: localization.serverFallbackUsed,
          localizationClientFallbackUsed: localization.clientFallbackUsed,
        });
        toast.error(aiErrorMessage('generation_validation_failed', requestedLocale));
        return;
      }
      const { data: rewriteData, response: res } = await apiFetch<{ result?: string; error?: string; code?: string; retryAfter?: number; repairAttempted?: boolean; fallbackUsed?: boolean }>('/api/generate', {
        body: {
          action: 'rewrite',
          proToken,
          text: liveSummaryAtPress,
          style,
          locale: requestedLocale,
          gender: liveCvAtPress.personal.gender || '',
          requestId: reqCtx.requestId,
          operationMode,
          cvContext: {
            personal: {
              ...liveCvAtPress.personal,
              jobTitle: localizedExperienceEntries[0]?.position
                || liveCvAtPress.personal.jobTitle,
            },
            summary: liveCvAtPress.canonicalSummary || liveCvAtPress.summary,
            canonicalSummary: liveCvAtPress.canonicalSummary || '',
            experience: localizedExperienceEntries.map((entry) => ({
              id: entry.id,
              position: entry.position,
              company: entry.company,
              startDate: entry.startDate,
              endDate: entry.isPresent ? '' : entry.endDate,
              isPresent: entry.isPresent,
              description: entry.description,
              canonicalDescription: entry.description,
              generatedLocale: requestedLocale,
              positionSourceLocale: requestedLocale,
            })),
            education: liveCvAtPress.education,
            skills: liveCvAtPress.skills,
            languages: liveCvAtPress.languages,
            certifications: liveCvAtPress.certifications,
          },
        },
        signal: controller.signal,
      });
      if (!res.ok || rewriteData?.error) {
        const payload = resolveAiHttpFailure({ response: res, body: rewriteData });
        const typedCode = payload.code === 'generation_validation_failed'
          ? 'summary_rewrite_failed'
          : payload.code;
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { ...payload, code: typedCode },
        });
        summaryDiag.stage('api_response', 'fail', typedCode || 'http_error');
        summaryDiag.patch({
          finalTypedFailureReason: typedCode || 'http_error',
          rejectionStage: 'api_response',
          countedAsSuccess: false,
        });
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'api_response_not_accepted');
        toast.error(msg ?? aiErrorMessage(typedCode, locale));
        return;
      }
      // Stale-response guard: only the most recently started rewrite may apply.
      if (latestRewriteRequestIdRef.current !== reqCtx.requestId) {
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: `rewrite_${style}`,
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_request_superseded',
        });
        summaryDiag.stage('race_guard', 'fail', 'stale_request_superseded');
        summaryDiag.patch({
          raceGuardResult: 'fail',
          finalTypedFailureReason: 'stale_request_superseded',
          rejectionStage: 'race_guard',
          countedAsSuccess: false,
        });
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'stale_request_superseded');
        return;
      }
      const liveNow = cvRef.current;
      if ((liveNow.summary || '').trim() !== liveSummaryAtPress) {
        finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'ai_request_stale', httpStatus: 409 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: `rewrite_${style}`,
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_summary_edited_in_flight',
        });
        summaryDiag.patch({
          actualRaceDetected: true,
          actualRaceReason: 'stale_summary_edited_in_flight',
          raceGuardResult: 'fail',
          finalTypedFailureReason: 'stale_summary_edited_in_flight',
          visibleApplyFailureStage: 'in_flight_source_changed',
        });
        summaryDiag.stage('race_guard', 'fail', 'stale_summary_edited_in_flight');
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'stale_summary_edited_in_flight');
        try {
          await summaryDiag.resolveVersions();
          summaryDiag.commit();
        } catch { /* ignore */ }
        toast.error(aiErrorMessage('ai_request_stale', locale));
        return;
      }
      if (!summaryV2SnapshotMatchesCv({
        cv: liveNow,
        locale: requestedLocale,
        gender: liveCvAtPress.personal.gender || '',
        referenceDateIso,
        expectedSnapshotHash: localization.sourceManifest.snapshotHash,
      })) {
        summaryDiag.stage('race_guard', 'fail', 'stale_experience_edited_in_flight');
        summaryDiag.patch({
          actualRaceDetected: true,
          actualRaceReason: 'stale_experience_edited_in_flight',
          raceGuardResult: 'fail',
          finalTypedFailureReason: 'stale_experience_edited_in_flight',
          rejectionStage: 'race_guard',
          countedAsSuccess: false,
        });
        summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'stale_experience_edited_in_flight');
        toast.error(aiErrorMessage('ai_request_stale', locale));
        return;
      }
      const rewriteAction = style === 'shorter'
        ? 'summary_shorter'
        : style === 'stronger'
          ? 'summary_stronger'
          : 'summary_professional';
      const finalizedGate = finalizeCvAiFieldForApply({
        action: rewriteAction,
        field: 'summary',
        requestedLocale,
        gender: liveNow.personal.gender || '',
        cv: liveNow,
        candidate: (rewriteData.result ?? liveSummaryAtPress).trim(),
        durationSnapshot,
        rewriteStyle: style,
        originHint: rewriteData.fallbackUsed
          ? 'deterministic_fallback'
          : rewriteData.repairAttempted
            ? 'ai_repaired'
            : 'ai_generated',
        localizedSummaryManifest: localization.manifest,
      });
      summaryDiag.recordFinalizeResult(finalizedGate);
      const rewriteOutcome = resolveSummaryFinalizeClientOutcome(
        finalizedGate,
        style === 'stronger' ? 'stronger_content_generation_failed' : 'summary_rewrite_failed',
      );
      if (rewriteOutcome.kind === 'clean_noop') {
        finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: null,
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: `rewrite_${style}`,
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'summary_noop_after_normalization',
        });
        summaryDiag.recordVisibleApplyNotApplicable(countBefore);
        try {
          await summaryDiag.resolveVersions();
          summaryDiag.commit();
        } catch { /* ignore diag commit failures */ }
        toast.error(aiErrorMessage('ai_noop', locale));
        return;
      }
      if (finalizedGate.blocked || !finalizedGate.countedAsSuccess) {
        const failCode = rewriteOutcome.toastCode
          || (style === 'stronger' ? 'stronger_content_generation_failed' : 'summary_rewrite_failed');
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: `rewrite_${style}`,
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: finalizedGate.reason || failCode,
        });
        summaryDiag.recordVisibleApplySkippedFailure(
          countBefore,
          finalizedGate.reason || 'final_candidate_rejected',
        );
        try {
          await summaryDiag.resolveVersions();
          summaryDiag.commit();
        } catch { /* ignore diag commit failures */ }
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      const preApplyGate = summaryDiag.evaluatePreApplyDecisionGates();
      if (!preApplyGate.passed) {
        const failCode = mapExperienceAiFailureToErrorCode(
          preApplyGate.reason || 'diagnostic_invariant_failed',
        );
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        summaryDiag.recordVisibleApplySkippedFailure(
          countBefore,
          preApplyGate.reason || 'diagnostic_preapply_gate_failed',
        );
        try {
          await summaryDiag.resolveVersions();
          summaryDiag.commit();
        } catch { /* ignore */ }
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      const applyCommit = commitSummaryApplyTransactionally({
        cvRef,
        ownership: summaryApplyOwnershipRef.current,
        locale: requestedLocale,
        finalized: finalizedGate,
        operationSourceText: liveSummaryAtPress,
        operationId: reqCtx.requestId,
        scheduleReactCv: scheduleSummaryCvCommit,
        persistCv: persistSummaryCvNow,
      });
      summaryDiag.patch({
        ...applyCommit.lifecycle,
        staleAutosaveWriteSuppressed: Boolean(
          summaryApplyOwnershipRef.current.lastStaleAutosaveSuppressedHash,
        ),
      });
      if (!applyCommit.ok) {
        const classified = classifySummaryVisibleApplyFailure({
          lifecycle: applyCommit.lifecycle,
          visibleHash: applyCommit.lifecycle.cvRefHashImmediatelyAfterWrite,
          selectedFinalHash: applyCommit.lifecycle.selectedFinalHash,
        });
        summaryDiag.patch({
          actualRaceDetected: classified.actualRaceDetected,
          actualRaceReason: classified.actualRaceReason,
          visibleApplyFailureStage: classified.visibleApplyFailureStage,
          raceGuardResult: classified.raceGuardResult,
          finalTypedFailureReason: classified.finalTypedFailureReason,
        });
        const failCode = mapExperienceAiFailureToErrorCode(
          classified.finalTypedFailureReason || 'summary_state_write_failed',
        );
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        summaryDiag.recordVisibleApply(false, countBefore);
        try {
          await summaryDiag.resolveVersions();
          summaryDiag.commit();
        } catch { /* ignore */ }
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      const visibleSummaryText = resolveAuthoritativeVisibleSummaryText({
        operationOwnedSummary: applyCommit.writtenSummary,
        staleReactSummary: '',
      });
      // Visible validation before usage increment (same Generate contract).
      summaryDiag.recordVisibleApply(true, countBefore, visibleSummaryText);
      const visibleOk = summaryDiag.visibleApplySucceeded;
      if (!visibleOk) {
        const classified = classifySummaryVisibleApplyFailure({
          lifecycle: {
            ...applyCommit.lifecycle,
            visibleApplyFailureStage: 'post_write_visible_hash_mismatch',
          },
          visibleHash: hashSummaryTextForApply(visibleSummaryText),
          selectedFinalHash: applyCommit.lifecycle.selectedFinalHash,
        });
        summaryDiag.patch({
          actualRaceDetected: classified.actualRaceDetected,
          actualRaceReason: classified.actualRaceReason,
          visibleApplyFailureStage: classified.visibleApplyFailureStage,
          raceGuardResult: classified.raceGuardResult,
          finalTypedFailureReason: classified.finalTypedFailureReason
            || summaryDiag.finalTypedFailureReason,
        });
        const failReason = classified.finalTypedFailureReason
          || summaryDiag.finalTypedFailureReason
          || 'summary_state_write_failed';
        const failCode = mapExperienceAiFailureToErrorCode(failReason);
        rollbackSummaryApplyTransactionally({
          cvRef,
          ownership: summaryApplyOwnershipRef.current,
          operationSourceText: liveSummaryAtPress,
          scheduleReactCv: scheduleSummaryCvCommit,
          persistCv: persistSummaryCvNow,
        });
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: failCode, httpStatus: 422 },
          responseSource: 'blocked',
        });
        summaryDiag.patch({
          countedAsSuccess: false,
          usageCountAfter: countBefore,
          visibleApplySucceeded: false,
        });
        try {
          await summaryDiag.resolveVersions();
          summaryDiag.commit();
        } catch { /* ignore */ }
        toast.error(msg ?? aiErrorMessage(failCode, locale));
        return;
      }
      recordProAiSuccess();
      summaryDiag.patch({ usageCountAfter: countBefore + 1 });
      finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore + 1,
        httpStatus: res.status,
        error: null,
        automaticRepairCount: rewriteData.repairAttempted ? 1 : 0,
        fallbackUsed: Boolean(rewriteData.fallbackUsed) || finalizedGate.origin === 'deterministic_fallback',
        responseSource: finalizedGate.origin === 'deterministic_fallback' || rewriteData.fallbackUsed
          ? 'deterministic_fallback'
          : rewriteData.repairAttempted
            ? 'repair'
            : 'provider',
      });
      logAiLocaleTransitionDiagnostics({
        requestId: reqCtx.requestId,
        action: `rewrite_${style}`,
        uiLocale: locale,
        requestedLocale,
        previousContentLocale,
        apiLocale: requestedLocale,
        finalValidationLocale: requestedLocale,
        applied: true,
        newContentLocale: requestedLocale,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: `rewrite_${style}`,
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: false,
        applied: true,
      });
      try {
        await summaryDiag.resolveVersions();
        summaryDiag.commit();
      } catch { /* ignore */ }
      toast.success(`${t.cv.rewriteSuccess} (${t.cv[style === 'shorter' ? 'short' : style === 'stronger' ? 'strong' : 'professional']})`);
    } catch (err) {
      const payload = resolveAiHttpFailure({ response: null, error: err });
      const msg = finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore,
        httpStatus: null,
        error: payload,
      });
      summaryDiag.stage('api_response', 'fail', payload.code || 'network_error');
      summaryDiag.recordVisibleApplySkippedFailure(countBefore, 'request_failed_before_apply');
      try {
        await summaryDiag.resolveVersions();
        summaryDiag.commit();
      } catch { /* ignore */ }
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: `rewrite_${style}`,
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: err instanceof Error && err.name === 'AbortError',
        applied: false,
        reason: payload.code,
      });
      toast.error(msg ?? aiErrorMessage(payload.code === 'network_error' ? 'network_error' : 'provider_temporarily_unavailable', locale));
    } finally {
      await terminalizeAiDiagnosticSession(summaryDiag);
      clearTimeout(timer);
      setRewritingStyle(null);
    }
  };

  const handleAnalyzeJob = () => {
    if (!jobDesc.trim()) return;
    if (!getCurrentProTokenOrToast(() => setJobAnalyzerModal(true))) return;
    setShowAnalysis(false);
    setAnalysis(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = analyzeJobDescription(jobDesc, locale);
      setAnalysis(result);
      setIsAnalyzing(false);
      setShowAnalysis(true);
      // Local heuristic only — does not consume Pro AI safety-cap quota.
    }, 1300);
  };

    const handleSave = () => {
    setCurrentCv(cv);
    toast.success(t.cv.saved);
  };

    const showCvExportSuccessToast = (
      saveResult: SaveFileResult,
      format: ExportFileFormat,
      fallbackFileName: string,
    ) => {
      const copy = getCvExportSuccessToast(saveResult, format, fallbackFileName, t.cv);
      if (!copy) return;
      toast.success(copy.title, { description: copy.description });
    };

    const showExportFailureToast = (
      err: unknown,
      format: 'pdf' | 'docx',
    ) => {
      const message = formatCvExportIntegrityToast(err, locale, format)
        || (format === 'pdf' ? t.cv.pdfExportFailed : t.cv.wordExportFailed);
      toast.error(message, {
        duration: 20_000,
        action: {
          label: 'Copy diagnostics',
          onClick: () => {
            void copyCvExportDiagnosticsToClipboard(format).then((ok) => {
              toast[ok ? 'success' : 'error'](
                ok ? 'Export diagnostics copied' : 'Could not copy diagnostics',
              );
            });
          },
        },
      });
      setExportDiagTick((n) => n + 1);
    };

    const recordExportDiagnostic = async (args: {
      format: 'pdf' | 'docx';
      rawCv: CVData;
      prepared: PrepareExportReadyResult | null;
      originalFailureReason?: string;
      finalError?: unknown;
      rendererReached?: boolean;
      blobProduced?: boolean;
      blobSize?: number | null;
      blobMimeType?: string | null;
      androidSaveReached?: boolean;
      saveResult?: SaveFileResult | null;
      extraStages?: Parameters<typeof buildAndStoreCvExportDiagnostic>[0]['extraStages'];
    }) => {
      const app = await resolveAppVersionInfo();
      buildAndStoreCvExportDiagnostic({
        format: args.format,
        locale,
        rawCv: args.rawCv,
        prepared: args.prepared,
        originalFailureReason: args.originalFailureReason,
        finalError: args.finalError,
        rendererReached: args.rendererReached,
        blobProduced: args.blobProduced,
        blobSize: args.blobSize,
        blobMimeType: args.blobMimeType,
        androidSaveReached: args.androidSaveReached,
        saveResult: args.saveResult,
        appVersionCode: app.versionCode,
        appVersionName: app.versionName,
        nextBuildId: resolveNextBuildId(),
        experienceLocalization: lastExperienceLocalizationRef.current,
        previewSummaryRender: lastPreviewSummaryRenderRef.current,
        extraStages: args.extraStages,
      });
      setExportDiagTick((n) => n + 1);
    };

    const prepareFinalLocaleSafeCv = async (
      sourceCv: CVData,
      options?: { purpose?: 'export' | 'preview' },
    ): Promise<CVData> => {
      const editorSourceCv = sourceCv;
      lastExportRawCvRef.current = sourceCv;
      lastExportPrepareRef.current = null;
      lastExperienceLocalizationRef.current = null;
      try {
        const experienceLocalizationOperationStartedAt = Date.now();
        const experienceLocalizationOperationDeadlineAt =
          computeExperienceLocalizationOperationDeadline(experienceLocalizationOperationStartedAt);
        // The export source becomes the race-guard authority before provider work.
        cvRef.current = sourceCv;
        const localization = await prepareExperienceLocalizedSurfaces({
          cv: sourceCv,
          targetLocale: locale,
          adapter: async (request: ExperienceLocalizationRequest) => {
            // Export localization is provider work but is not a visible AI-button
            // action, so authenticate it without consuming or enforcing the
            // user-facing AI-button usage counter.
            const aiGate = getAiGate();
            if (aiGate.status !== 'ready') {
              throw new Error('experience_localization_authorization_unavailable');
            }
            const circuitError = precheckAiCircuit(locale);
            if (circuitError) {
              throw new Error('experience_localization_provider_unavailable');
            }
            const proToken = aiGate.token;
            const operationRemainingMs = experienceLocalizationOperationDeadlineAt - Date.now();
            if (operationRemainingMs < 1_000) {
              throw new Error('experience_localization_operation_deadline_exceeded');
            }
            const controller = new AbortController();
            experienceLocalizationAbortRef.current = controller;
            const timeout = window.setTimeout(
              () => controller.abort(),
              resolveClientAbortTimeoutMs(Math.min(
                EXPERIENCE_LOCALIZATION_CLIENT_TIMEOUT_MS,
                operationRemainingMs,
              )),
            );
            try {
              const { data, response } = await apiFetch<{
                localizedExperienceSurfaces?: ExperienceLocalizationProviderResponse;
                error?: string;
                localizationTypedFailureReason?: string;
                translationProviderAttemptCount?: number;
                independentVerifierAttemptCount?: number;
                translatedRecordCount?: number;
                verifiedRecordCount?: number;
                translationResponded?: boolean;
                translationParserPassed?: boolean;
                compactTranslatorIdsValidated?: boolean;
                fullIdentitiesReconstructed?: boolean;
                candidateHashesComputed?: boolean;
                verifierDispatched?: boolean;
                verifierResponded?: boolean;
                verifierParserReached?: boolean;
                routeRemainingAtVerifierDispatchMs?: number;
              }>('/api/generate', {
                body: {
                  action: 'experience-localize',
                  proToken,
                  requestId: crypto.randomUUID(),
                  ...request,
                },
                signal: controller.signal,
              });
              if (!response.ok || !data?.localizedExperienceSurfaces) {
                const failure = new Error(
                  data?.localizationTypedFailureReason
                  || data?.error
                  || 'experience_localization_provider_failed',
                ) as Error & {
                  translationProviderAttemptCount?: number;
                  independentVerifierAttemptCount?: number;
                  translatedRecordCount?: number;
                  verifiedRecordCount?: number;
                  translationResponded?: boolean;
                  translationParserPassed?: boolean;
                  compactTranslatorIdsValidated?: boolean;
                  fullIdentitiesReconstructed?: boolean;
                  candidateHashesComputed?: boolean;
                  verifierDispatched?: boolean;
                  verifierResponded?: boolean;
                  verifierParserReached?: boolean;
                  routeRemainingAtVerifierDispatchMs?: number;
                };
                failure.translationProviderAttemptCount = data?.translationProviderAttemptCount;
                failure.independentVerifierAttemptCount = data?.independentVerifierAttemptCount;
                failure.translatedRecordCount = data?.translatedRecordCount;
                failure.verifiedRecordCount = data?.verifiedRecordCount;
                failure.translationResponded = data?.translationResponded;
                failure.translationParserPassed = data?.translationParserPassed;
                failure.compactTranslatorIdsValidated = data?.compactTranslatorIdsValidated;
                failure.fullIdentitiesReconstructed = data?.fullIdentitiesReconstructed;
                failure.candidateHashesComputed = data?.candidateHashesComputed;
                failure.verifierDispatched = data?.verifierDispatched;
                failure.verifierResponded = data?.verifierResponded;
                failure.verifierParserReached = data?.verifierParserReached;
                failure.routeRemainingAtVerifierDispatchMs = data?.routeRemainingAtVerifierDispatchMs;
                throw failure;
              }
              return data.localizedExperienceSurfaces;
            } finally {
              window.clearTimeout(timeout);
              if (experienceLocalizationAbortRef.current === controller) {
                experienceLocalizationAbortRef.current = null;
              }
            }
          },
          getCurrentCv: () => cvRef.current,
          operationDeadlineAt: experienceLocalizationOperationDeadlineAt,
          persist: (nextCv, expectedSnapshotId) => {
            const currentSnapshot = buildExperienceLocalizationSnapshot(cvRef.current, locale);
            if (!currentSnapshot.ok || currentSnapshot.snapshotId !== expectedSnapshotId) {
              return false;
            }
            if ((options?.purpose || 'export') === 'preview') {
              // Preview preparation may consume the validated in-memory
              // projection returned by this operation, but it must not mutate
              // the editor draft or its persisted localization caches.
              return true;
            }
            const safeNext = buildPersistableCvAfterExportPreparation(cvRef.current, nextCv);
            if (!exportDraftVisibleContentPreserved(cvRef.current, safeNext)) return false;
            const persisted = persistCurrentCvTransactionally(safeNext);
            if (!persisted) return false;
            cvRef.current = safeNext;
            setCv(safeNext);
            return true;
          },
        });
        lastExperienceLocalizationRef.current = localization.diagnostics;
        if (!localization.ok) {
          throw new CvExportFailure(localization.reason, `${localization.reason} @ ${localization.stage}`);
        }
        sourceCv = localization.cv;
        // Single export-ready snapshot for all templates/formats before branching.
        const primaryExpId = (sourceCv.experience || []).find((e) => e.isPresent)?.id
          || (sourceCv.experience || [])[0]?.id;
        const prepareOptions = {
          gender: sourceCv.personal?.gender,
          industry: primaryExpId ? (expIndustry[primaryExpId] ?? 'general') : 'general',
          level: primaryExpId ? (expLevel[primaryExpId] ?? 'mid') : 'mid',
        };
        const prepared = prepareExportReadyCv(
          sourceCv,
          locale,
          sourceCv.templateId,
          prepareOptions,
        );
        lastExportPrepareRef.current = prepared;
        if (!prepared.ok) {
          // Preserve the exact typed reason for diagnostics before any remapping.
          const originalReason = prepared.reason;
          if (
            sourceCv.templateId === 'modern-minimal'
            && /stale|overwritten|not_invoked|projection_incomplete/i.test(prepared.reason)
          ) {
            throw new CvExportFailure(
              'modern_minimal_stale_snapshot',
              `${originalReason} @ ${prepared.stage}`,
            );
          }
          throw new CvExportFailure(prepared.reason, `${prepared.reason} @ ${prepared.stage}`);
        }
        const recoveredCv = prepared.cv;
        const diagnostics = prepared.diagnostics;
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[CV export] prepareExportReadyCv', {
            templateId: recoveredCv.templateId,
            recoveryInvoked: diagnostics.recoveryInvoked,
            semanticDutyKeys: diagnostics.summarySemanticDutyKeys,
            summaryFactSetSource: diagnostics.summaryFactSetSource,
            summaryInitialReason: diagnostics.summaryInitialReason,
            summaryRecoverySource: diagnostics.summaryRecoverySource,
            stage: diagnostics.stage,
          });
        }
        const titleLocalizationOperationDeadlineAt =
          computeExperienceLocalizationOperationDeadline(Date.now());
        const titleRepairContextByBatchKey = new Map<string, unknown>();
        const titleTransportDiagnostics: Partial<ExperienceLocalizationDiagnostics> = {};
        const previewSelectedEntryIds = (options?.purpose || 'export') === 'preview'
          ? new Set(
            (sourceCv.experience || [])
              .filter((entry) => (
                prepared.diagnostics.summarySelectedEntryHashes || []
              ).includes(hashSummaryV2Text(entry.id)))
              .map((entry) => entry.id),
          )
          : undefined;
        const titleLocalization = await prepareExportLocalizedTitles({
          sourceCv,
          exportCv: recoveredCv,
          targetLocale: locale,
          gender: sourceCv.personal?.gender,
          getCurrentCv: () => cvRef.current,
          experienceIds: previewSelectedEntryIds,
          includePersonalTitle: (options?.purpose || 'export') === 'export',
          adapter: async (request: ExportTitleLocalizationTransportInput) => {
            const aiGate = getAiGate();
            if (aiGate.status !== 'ready') {
              Object.assign(titleTransportDiagnostics, {
                titleTransportFailureReason:
                  'export_title_localization_authorization_unavailable',
                titleTransportFailureStage: 'title_client_authorization',
                titleTransportHttpStatus: null,
                titleTransportApplicationCode: null,
                titleTransportProviderStatus: null,
                titleTransportDeadlineOwner: null,
                titleTransportRepairContextPresent: false,
              });
              throw new Error('export_title_localization_authorization_unavailable');
            }

            const operationRemainingMs =
              titleLocalizationOperationDeadlineAt - Date.now();
            if (operationRemainingMs < 1_000) {
              Object.assign(titleTransportDiagnostics, {
                titleTransportFailureReason:
                  'export_title_localization_operation_deadline_exceeded',
                titleTransportFailureStage: 'title_client_operation_deadline',
                titleTransportHttpStatus: null,
                titleTransportApplicationCode: null,
                titleTransportProviderStatus: null,
                titleTransportDeadlineOwner: 'client_operation_deadline',
                titleTransportRepairContextPresent: false,
              });
              throw new Error('export_title_localization_operation_deadline_exceeded');
            }

            const batchKey = request.entries
              .map((entry) => entry.entryId)
              .join('\u001f');
            const repairContext = request.repair
              ? titleRepairContextByBatchKey.get(batchKey)
              : undefined;

            const controller = new AbortController();
            experienceLocalizationAbortRef.current = controller;
            const timeout = window.setTimeout(
              () => controller.abort(),
              resolveClientAbortTimeoutMs(Math.min(
                EXPERIENCE_LOCALIZATION_CLIENT_TIMEOUT_MS,
                operationRemainingMs,
              )),
            );

            try {
              const { data, response } = await apiFetch<{
                localizedManifest?: SummaryV2LocalizationProviderResponse;
                code?: string;
                retryAfter?: number;
                providerStatus?: number | string | null;
                localizationTypedFailureReason?: string;
                localizationFailureStage?: string;
                deadlineOwner?: string | null;
                titleTranslatorAttemptCount?: number;
                titleVerifierAttemptCount?: number;
                titleRepairContext?: unknown;
              }>('/api/generate', {
                body: {
                  action: 'export-title-localize',
                  proToken: aiGate.token,
                  requestId: crypto.randomUUID(),
                  ...request,
                  ...(repairContext ? { repairContext } : {}),
                },
                signal: controller.signal,
              });

              if (!response.ok || !data?.localizedManifest) {
                const reasonByCode: Record<string, string> = {
                  invalid_pro_token: 'export_title_localization_authorization_failed',
                  free_ai_limit_reached: 'export_title_localization_authorization_failed',
                  server_rate_limited: 'export_title_localization_server_rate_limited',
                  provider_rate_limited:
                    'export_title_localization_provider_rate_limited',
                  provider_auth_error:
                    'export_title_localization_provider_auth_error',
                  provider_credit_exhausted:
                    'export_title_localization_provider_credit_exhausted',
                  provider_temporarily_unavailable:
                    'export_title_localization_provider_temporarily_unavailable',
                  request_timeout:
                    'export_title_localization_transport_timeout',
                };
                const fallbackReason = response.status === 403
                  ? 'export_title_localization_authorization_failed'
                  : response.status === 429
                    ? 'export_title_localization_server_rate_limited'
                    : response.status >= 500
                      ? 'export_title_localization_service_unavailable'
                      : response.status === 422
                        ? 'export_title_localization_server_validation_failed'
                        : 'export_title_localization_http_failure';
                const failureReason = data?.localizationTypedFailureReason
                  || reasonByCode[String(data?.code || '')]
                  || fallbackReason;

                if (data?.titleRepairContext) {
                  titleRepairContextByBatchKey.set(
                    batchKey,
                    data.titleRepairContext,
                  );
                }

                Object.assign(titleTransportDiagnostics, {
                  titleTransportFailureReason: failureReason,
                  titleTransportFailureStage:
                    data?.localizationFailureStage || 'title_http_response',
                  titleTransportHttpStatus: response.status,
                  titleTransportApplicationCode: data?.code || null,
                  titleTransportProviderStatus: data?.providerStatus ?? null,
                  titleTransportDeadlineOwner: data?.deadlineOwner ?? null,
                  titleTransportTranslatorAttemptCount:
                    data?.titleTranslatorAttemptCount ?? null,
                  titleTransportVerifierAttemptCount:
                    data?.titleVerifierAttemptCount ?? null,
                  titleTransportRetryAfterSec: data?.retryAfter ?? null,
                  titleTransportRepairContextPresent:
                    Boolean(data?.titleRepairContext),
                });

                throw new Error(failureReason);
              }

              titleRepairContextByBatchKey.delete(batchKey);
              return data.localizedManifest;
            } catch (error) {
              if (
                error instanceof Error
                && /^export_title_localization_[a-z0-9_]+$/u.test(error.message)
              ) {
                throw error;
              }

              const failureReason =
                error instanceof Error && error.name === 'AbortError'
                  ? 'export_title_localization_client_abort'
                  : 'export_title_localization_network_failure';
              Object.assign(titleTransportDiagnostics, {
                titleTransportFailureReason: failureReason,
                titleTransportFailureStage: 'title_client_transport',
                titleTransportHttpStatus: null,
                titleTransportApplicationCode: null,
                titleTransportProviderStatus: null,
                titleTransportDeadlineOwner:
                  failureReason === 'export_title_localization_client_abort'
                    ? 'client_abort'
                    : null,
                titleTransportRepairContextPresent:
                  Boolean(titleRepairContextByBatchKey.get(batchKey)),
              });
              throw new Error(failureReason);
            } finally {
              window.clearTimeout(timeout);
              if (experienceLocalizationAbortRef.current === controller) {
                experienceLocalizationAbortRef.current = null;
              }
            }
          },
        });
        lastExperienceLocalizationRef.current = {
          ...(lastExperienceLocalizationRef.current || localization.diagnostics),
          ...titleLocalization.diagnostics,
          ...titleTransportDiagnostics,
          titleTransportRecovered:
            titleLocalization.ok
            && Object.keys(titleTransportDiagnostics).length > 0,
          exportDraftIsolationRevision: CV_EXPORT_DRAFT_ISOLATION_REVISION,
        };
        if (!titleLocalization.ok) {
          throw new CvExportFailure(titleLocalization.reason, titleLocalization.reason);
        }
        // Title projection can increase Summary length or change role-context
        // metadata. Re-run the same canonical export validator on the complete
        // localized projection before any renderer or DOCX branch receives it.
        const titleKey = (value: string) => value
          .normalize('NFKC')
          .replace(/\s+/gu, ' ')
          .trim()
          .toLocaleLowerCase();
        const recoveredPositions = new Map(
          (recoveredCv.experience || []).map((entry) => [entry.id, entry.position || '']),
        );
        const titleProjectionChanged = (
          (options?.purpose || 'export') === 'export'
          && titleKey(titleLocalization.exportCv.personal?.jobTitle || '')
            !== titleKey(recoveredCv.personal?.jobTitle || '')
        )
          || (titleLocalization.exportCv.experience || []).some(
            (entry) => (!previewSelectedEntryIds || previewSelectedEntryIds.has(entry.id))
              && titleKey(recoveredPositions.get(entry.id) || '')
                !== titleKey(entry.position || ''),
          )
          || hashSummaryV2Text(titleLocalization.exportCv.summary || '')
            !== hashSummaryV2Text(recoveredCv.summary || '');
        const postTitlePrepared = titleProjectionChanged
          ? prepareExportReadyCv(
            titleLocalization.exportCv,
            locale,
            titleLocalization.exportCv.templateId,
            prepareOptions,
          )
          : prepared;
        lastExportPrepareRef.current = postTitlePrepared;
        lastExperienceLocalizationRef.current = {
          ...(lastExperienceLocalizationRef.current || localization.diagnostics),
          titlePostProjectionValidationPassed: postTitlePrepared.ok,
          ...(!postTitlePrepared.ok
            ? { titlePostProjectionFailureReason: postTitlePrepared.reason }
            : {}),
        };
        if (!postTitlePrepared.ok) {
          throw new CvExportFailure(
            postTitlePrepared.reason,
            `${postTitlePrepared.reason} @ title_post_projection_validation`,
          );
        }
        if ((options?.purpose || 'export') === 'export' && sameSnapshotPreviewParityFailure({
          evidence: lastPreviewSummaryRenderRef.current,
          sourceCv: editorSourceCv,
          locale,
          context: prepareOptions,
          selectedFinalSummaryHash: postTitlePrepared.diagnostics.selectedFinalSummaryHash,
        })) {
          throw new CvExportFailure(
            'preview_render_mismatch',
            'preview_render_mismatch @ same_snapshot_preview_parity',
          );
        }
        const exportCv = postTitlePrepared.cv;
        const metadataSource: CVData = {
          ...exportCv,
          experienceLocalizedSurfaces:
            titleLocalization.persistableCv.experienceLocalizedSurfaces,
          exportLocalizedTitleSurfaces:
            titleLocalization.persistableCv.exportLocalizedTitleSurfaces,
        };
        const groundingPersisted = buildPersistableCvAfterExportPreparation(
          editorSourceCv,
          metadataSource,
        );
        const visibleContentPreserved = exportDraftVisibleContentPreserved(
          editorSourceCv,
          groundingPersisted,
        );
        lastExperienceLocalizationRef.current = {
          ...(lastExperienceLocalizationRef.current || localization.diagnostics),
          exportDraftIsolationRevision: CV_EXPORT_DRAFT_ISOLATION_REVISION,
          exportDraftVisibleContentPreserved: visibleContentPreserved,
        };
        if (!visibleContentPreserved) {
          throw new CvExportFailure(
            'export_draft_isolation_failed',
            'export-only content attempted to mutate the editor draft',
          );
        }
        if ((options?.purpose || 'export') === 'export') {
          cvRef.current = groundingPersisted;
          setCv(groundingPersisted);
          setCurrentCv(groundingPersisted);
        }

        // All template families consume the same terminal per-entry
        // presentation selected above. Creative Artistic and Corporate Navy
        // historically re-ran their legacy canonical-bullet localizers here,
        // which rejected valid Serbian current_visible/projection surfaces
        // after the shared resolver had already validated them. Keep those
        // adapters as a fallback for legacy inputs, but never let them replace
        // a complete terminal snapshot.
        const terminalPresentationReady = isTerminalExperiencePresentationReady(
          exportCv,
          postTitlePrepared.diagnostics.experiencePresentation,
          locale,
        );
        if (terminalPresentationReady) return exportCv;

        if (exportCv.templateId === 'creative-artistic') {
          return prepareCreativeArtisticExport(exportCv, locale, {
            gender: exportCv.personal?.gender,
          }).cv;
        }
        if (exportCv.templateId === 'corporate-navy') {
          return prepareCorporateNavyExport(exportCv, locale, {
            gender: exportCv.personal?.gender,
          }).cv;
        }
        return exportCv;
      } catch (err) {
        throw wrapCvExportFailure(err, 'legacy_export_recovery_not_invoked');
      }
    };

    prepareFinalLocaleSafeCvRef.current = prepareFinalLocaleSafeCv;

    useEffect(() => {
      const previewVisible = showPreview || step === steps.length - 1;
      if (!previewVisible || !previewSourceIsAppOwned || matchingTerminalPreview) return;

      const requestRevision = terminalPreviewRequestRef.current + 1;
      terminalPreviewRequestRef.current = requestRevision;
      const sourceSnapshotId = previewInputSnapshotId;
      const sourceCv = resolveCvExportSourceAuthority(cvRef.current, cv.templateId);
      const prepare = prepareFinalLocaleSafeCvRef.current;
      if (!prepare) return;

      void prepare(sourceCv, { purpose: 'preview' }).then((terminalCv) => {
        if (terminalPreviewRequestRef.current !== requestRevision) return;
        const currentSource = resolveCvExportSourceAuthority(cvRef.current, cv.templateId);
        const currentSnapshotId = buildPreviewSummarySnapshotId(
          currentSource,
          locale,
          previewPrepareOptions,
        );
        if (currentSnapshotId !== sourceSnapshotId) return;
        setTerminalPreviewPresentation({
          snapshotId: sourceSnapshotId,
          status: 'ready',
          cv: terminalCv,
          selectedFinalSummaryHash: hashSummaryV2Text(terminalCv.summary || ''),
        });
      }).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[CV Preview] terminal preparation failed', error);
        }
        if (terminalPreviewRequestRef.current !== requestRevision) return;
        setTerminalPreviewPresentation({
          snapshotId: sourceSnapshotId,
          status: 'failed',
          cv: null,
          selectedFinalSummaryHash: null,
        });
      });
    }, [
      cv.templateId,
      locale,
      matchingTerminalPreview,
      previewInputSnapshotId,
      previewPrepareOptions,
      previewSourceIsAppOwned,
      showPreview,
      step,
      steps.length,
    ]);

    const handleDOCXDownload = async () => {
      if (!canDownload('cv')) {
        setLimitModal({ open: true, type: 'cv' });
        return;
      }
      if (isWordExporting || exportInFlightRef.current) return;
      exportInFlightRef.current = true;
      setShowDownloadMenu(false);
      setIsWordExporting(true);
      try {
        const liveCv = cvRef.current;
        let saveResult: SaveFileResult;
        let fallbackFileName: string;
        if (liveCv.templateId === 'rirekisho') {
          const cvForExport = await prepareFinalLocaleSafeCv(liveCv);
          const exportBaseName = cvForExport.personal.fullName || '履歴書';
          saveResult = await exportRirekishoToDOCX(cvForExport, exportBaseName);
          fallbackFileName = `${exportBaseName}.docx`;
        } else {
          // For rect-photo templates, use rectangularPhotoDataUrl (derived from original upload).
          // For circle templates, use circularPhotoDataUrl or cv.personal.photo.
          let photoForExport: string | undefined;
          let elegantFormalPhoto: ElegantFormalCanonicalPhotoResult | null = null;
          if (liveCv.templateId === 'elegant-formal') {
            elegantFormalPhoto = await ensureElegantFormalPhotoForExport();
            photoForExport = elegantFormalPhoto?.dataUrl;
          } else if (RECT_PHOTO_TEMPLATES.includes(liveCv.templateId)) {
            photoForExport = rectangularPhotoDataUrl ?? liveCv.personal.photo; // clean JPEG from original when available
          } else if (liveCv.templateId === 'corporate-navy' || liveCv.templateId === 'contemporary-bold') {
            photoForExport = (liveCv.personal as typeof liveCv.personal & { originalPhoto?: string }).originalPhoto
              ?? circularPhotoDataUrl
              ?? liveCv.personal.photo;
          } else {
            photoForExport = circularPhotoDataUrl ?? liveCv.personal.photo;
          }
          const selectedTemplateId = cv.templateId;
          const latestCv = resolveCvExportSourceAuthority(
            cvRef.current,
            selectedTemplateId,
          );
          const cvForExport = await prepareFinalLocaleSafeCv({
            ...latestCv,
            personal: { ...latestCv.personal, photo: photoForExport },
          });
          const experiencePresentationReady = isTerminalExperiencePresentationReady(
            cvForExport,
            lastExportPrepareRef.current?.diagnostics.experiencePresentation,
            locale,
          );
          const exportBaseName = makeCvExportBaseName(cvForExport.personal.fullName);
          saveResult = await exportToDOCX(
            cvForExport,
            exportBaseName,
            locale,
            cvForExport.templateId,
            { elegantFormalPhoto, experiencePresentationReady },
          );
          fallbackFileName = `${exportBaseName}.docx`;
          await recordExportDiagnostic({
            format: 'docx',
            rawCv: lastExportRawCvRef.current || latestCv,
            prepared: lastExportPrepareRef.current,
            rendererReached: true,
            blobProduced: true,
            blobMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            androidSaveReached: true,
            saveResult,
            extraStages: [
              { stage: 'render_blob', result: 'ok' },
              { stage: 'android_save', result: saveResult.result === 'saved' ? 'ok' : 'fail' },
            ],
          });
        }
        showCvExportSuccessToast(saveResult, 'docx', fallbackFileName);
        incrementDownloads('cv');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'SaveCancelledError') return;
        if (process.env.NODE_ENV !== 'production') console.error('[CV DOCX export] failed:', err);
        const prepared = lastExportPrepareRef.current;
        const originalReason = prepared && !prepared.ok ? prepared.reason : undefined;
        const terminalReason = extractCvExportFailureReason(err);
        const previewParityBlocked = /preview_render_mismatch/iu.test(terminalReason);
        await recordExportDiagnostic({
          format: 'docx',
          rawCv: lastExportRawCvRef.current || cvRef.current,
          prepared,
          originalFailureReason: originalReason,
          finalError: err,
          rendererReached: previewParityBlocked ? false : Boolean(prepared?.ok),
          blobProduced: false,
          androidSaveReached: /android_file_save_failed/i.test(extractCvExportFailureReason(err)),
          extraStages: previewParityBlocked
            ? [{ stage: 'same_snapshot_preview_parity', result: 'fail', reason: terminalReason }]
            : prepared?.ok
              ? [{ stage: 'render_blob', result: 'fail', reason: terminalReason }]
            : undefined,
        });
        showExportFailureToast(err, 'docx');
      } finally {
        exportInFlightRef.current = false;
        setIsWordExporting(false);
      }
    };

    const handlePDFDownload = async (previewId: string) => {
      if (!canDownload('cv')) {
        setLimitModal({ open: true, type: 'cv' });
        return;
      }
      if (isPdfExporting || exportInFlightRef.current) return;
      exportInFlightRef.current = true;
      setShowDownloadMenu(false);
      setIsPdfExporting(true);
      try {
        // selectedTemplateId is the live UI selection and is authoritative over any
        // stale cvRef.current/localStorage templateId (hard requirement — do not
        // let a stale ref silently redirect Modern Minimal into another renderer).
        const selectedTemplateId = cv.templateId;
        const cvRefTemplateId = cvRef.current.templateId;
        const previewTemplateId = readPdfExportTemplateIdFromPreview(previewId);
        if (cvRefTemplateId !== selectedTemplateId) {
          console.error(
            `[CV PDF export] cvRef.current.templateId (${cvRefTemplateId}) !== selectedTemplateId (${selectedTemplateId}) — overwriting before export`,
          );
        }
        // Force templateId from the live UI selection; cvRef.current can only supply
        // the rest of the data, never the template choice.
        const cvForExport = await prepareFinalLocaleSafeCv(
          resolveCvExportSourceAuthority(
            cvRef.current,
            selectedTemplateId,
          ),
        );
        const route = resolveCvPdfExportRoute(selectedTemplateId);

        if (process.env.NODE_ENV !== 'production') {
          console.debug('[CV PDF export] tap', {
            selectedTemplateId,
            cvRefTemplateId,
            previewTemplateId,
            route: route.kind,
          });
        }

        const exportFunctionForTrace =
          selectedTemplateId === 'modern-minimal'
            ? 'exportModernMinimalPdf'
            : route.kind === 'generic-preview'
              ? 'exportToPDF'
              : `dedicated-${selectedTemplateId}`;

        recordCvPdfExportRuntimeTrace({
          selectedTemplateId,
          cvRefTemplateId,
          exportTemplateId: selectedTemplateId,
          previewTemplateId,
          routeKind: route.kind,
          exportFunction: exportFunctionForTrace,
          at: new Date().toISOString(),
        });

        const exportFilename = makeCvExportBaseName(cvForExport.personal.fullName);

        if (selectedTemplateId === 'modern-minimal') {
          if (route.kind !== 'dedicated-modern-minimal') {
            toast.error(t.cv.pdfExportFailed);
            throw new Error(`Modern Minimal route mismatch: ${route.kind}`);
          }
          if (previewTemplateId && previewTemplateId !== 'modern-minimal') {
            toast.error(t.cv.pdfExportFailed);
            throw new Error(`Modern Minimal preview mismatch: ${previewTemplateId}`);
          }
          const saveResult = await exportModernMinimalPdf(cvForExport, exportFilename, locale);
          await recordExportDiagnostic({
            format: 'pdf',
            rawCv: lastExportRawCvRef.current || cvForExport,
            prepared: lastExportPrepareRef.current,
            rendererReached: true,
            blobProduced: true,
            blobMimeType: 'application/pdf',
            androidSaveReached: true,
            saveResult,
            extraStages: [
              { stage: 'render_blob', result: 'ok' },
              { stage: 'android_save', result: saveResult.result === 'saved' ? 'ok' : 'fail' },
            ],
          });
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }

        if (previewTemplateId === 'modern-minimal') {
          toast.error(t.cv.pdfExportFailed);
          throw new Error('Modern Minimal preview detected outside dedicated export path');
        }

        const pdfResolution = resolveCvForPdfExport(cvForExport, {
          previewElementId: previewId,
          uiTemplateId: selectedTemplateId,
        });
        const liveCv = pdfResolution.exportCv;
        const terminalExperiencePresentationReady = isTerminalExperiencePresentationReady(
          liveCv,
          lastExportPrepareRef.current?.diagnostics.experiencePresentation,
          locale,
        );
        if (pdfResolution.route.kind === 'dedicated-clean-simple') {
          const saveResult = await exportCleanSimplePdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'professional-classic') {
          const saveResult = await exportProfessionalClassicPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'creative-bold') {
          const saveResult = await exportCreativeBoldPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'creative-artistic') {
          const saveResult = await exportCreativeArtisticPdf(
            liveCv,
            exportFilename,
            locale,
            { alreadyPrepared: terminalExperiencePresentationReady },
          );
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          await recordExportDiagnostic({
            format: 'pdf',
            rawCv: lastExportRawCvRef.current || cvForExport,
            prepared: lastExportPrepareRef.current,
            rendererReached: true,
            blobProduced: true,
            blobMimeType: 'application/pdf',
            androidSaveReached: true,
            saveResult,
            extraStages: [
              { stage: 'render_blob', result: 'ok' },
              { stage: 'android_save', result: saveResult.result === 'saved' ? 'ok' : 'fail' },
            ],
          });
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'elegant-formal') {
          const photoDataUrl = await prepareElegantFormalPdfPhotoDataUrl();
          const saveResult = await exportElegantFormalPdf(liveCv, exportFilename, locale, { photoDataUrl });
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'ats-standard') {
          const saveResult = await exportAtsStandardPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'executive-premium') {
          const saveResult = await exportExecutivePremiumPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'nordic-clean') {
          const saveResult = await exportNordicCleanPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'tech-sidebar') {
          const saveResult = await exportTechSidebarPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'corporate-navy') {
          const saveResult = await exportCorporateNavyPdf(
            liveCv,
            exportFilename,
            locale,
            { alreadyPrepared: terminalExperiencePresentationReady },
          );
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'contemporary-bold') {
          const saveResult = await exportContemporaryBoldPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'rirekisho') {
          const saveResult = await exportRirekishoPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        // ── Guard: for rect-photo templates, wait until rectangularPhotoDataUrl has been
        //    computed AND React has committed it to the DOM <img src> attribute.
        //    Poll for up to 3 s in 50 ms increments, then proceed regardless.
        if (RECT_PHOTO_TEMPLATES.includes(liveCv.templateId) && photoForCurrentTemplate) {
          const expectedFragment = '#rect';
          const deadline = Date.now() + 3000;
          while (Date.now() < deadline) {
            const exportNode = document.getElementById(previewId);
            const firstImg = exportNode?.querySelector('img');
            if (firstImg && (firstImg.src.includes(expectedFragment) || firstImg.complete)) break;
            await new Promise(r => setTimeout(r, 50));
          }
          // Extra two rAFs to let the browser finish painting the new src
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }

        assertDedicatedPdfRouteWasHandled(pdfResolution);

        const saveResult = await exportToPDF(previewId, exportFilename);
        showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
        incrementDownloads('cv');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'SaveCancelledError') return;
        if (process.env.NODE_ENV !== 'production') console.error('[CV PDF export] failed:', err);
        const prepared = lastExportPrepareRef.current;
        const originalReason = prepared && !prepared.ok ? prepared.reason : undefined;
        const terminalReason = extractCvExportFailureReason(err);
        const previewParityBlocked = /preview_render_mismatch/iu.test(terminalReason);
        await recordExportDiagnostic({
          format: 'pdf',
          rawCv: lastExportRawCvRef.current || cvRef.current,
          prepared,
          originalFailureReason: originalReason,
          finalError: err,
          rendererReached: previewParityBlocked ? false : Boolean(prepared?.ok),
          blobProduced: false,
          androidSaveReached: /android_file_save_failed/i.test(extractCvExportFailureReason(err)),
          extraStages: previewParityBlocked
            ? [{ stage: 'same_snapshot_preview_parity', result: 'fail', reason: terminalReason }]
            : prepared?.ok
              ? [{ stage: 'render_blob', result: 'fail', reason: terminalReason }]
            : undefined,
        });
        const cv = { templateId: cvRef.current.templateId, personal: { fullName: cvRef.current.personal.fullName } };
        if (cv.templateId === 'modern-minimal' || cv.templateId === 'clean-simple' || cv.templateId === 'professional-classic' || cv.templateId === 'creative-bold' || cv.templateId === 'creative-artistic' || cv.templateId === 'elegant-formal' || cv.templateId === 'ats-standard' || cv.templateId === 'executive-premium' || cv.templateId === 'nordic-clean' || cv.templateId === 'tech-sidebar' || cv.templateId === 'corporate-navy' || cv.templateId === 'contemporary-bold' || cv.templateId === 'rirekisho') {
          toast.error(formatCvExportIntegrityToast(err, locale, 'pdf') || t.cv.pdfExportFailed, {
            duration: 20_000,
            action: {
              label: 'Copy diagnostics',
              onClick: () => {
                void copyCvExportDiagnosticsToClipboard('pdf').then((ok) => {
                  toast[ok ? 'success' : 'error'](
                    ok ? 'Export diagnostics copied' : 'Could not copy diagnostics',
                  );
                });
              },
            },
          });
          setExportDiagTick((n) => n + 1);
          return;
        }
        // Fallback: attempt print-ready window once so user can Save as PDF via browser.
        // Do NOT increment downloads here — we cannot confirm the user actually saves the file.
        try {
          await openPrintFallback(previewId, cv.personal.fullName || 'CV');
        } catch (fallbackErr) {
          // Cancellation by user is silent — no error toast
          if (fallbackErr instanceof Error &&
              (fallbackErr.name === 'PrintCancelledError' || fallbackErr.name === 'SaveCancelledError')) {
            if (process.env.NODE_ENV !== 'production') console.error('[CV PDF export] fallback was cancelled:', fallbackErr.message);
            return;
          }
          if (process.env.NODE_ENV !== 'production') console.error('[CV PDF export] print fallback also failed:', fallbackErr);
          showExportFailureToast(fallbackErr, 'pdf');
        }
      } finally {
        exportInFlightRef.current = false;
        setIsPdfExporting(false);
      }
    };

    const handleTemplateRecommend = () => {
      if (!getCurrentProTokenOrToast(() => setAiRecommendModal(true))) return;
      const recommended = recommendTemplate(cv);
      commitCvUpdate(prev => ({ ...prev, templateId: recommended }));
      setRecommendedTemplateId(recommended);
      markAiRecommendUsed();
      // Local recommend — does not consume Pro AI safety-cap quota.
      toast.success(`${t.cv.recommendedToast}: ${t.templates.items[recommended].name}`);
    };

    const handleTemplateSelect = (id: TemplateId) => {
      const info = templateInfo[id];
      if (info.isPro && !isPro) {
        setProTemplateModal(true);
        return;
      }
      commitCvUpdate(prev => ({ ...prev, templateId: id }));
    };

  const TemplateComponent = templateComponents[cv.templateId];
  const trimmedSkillQuery = skillInput.trim();
  const shouldShowSkillSuggestions = showSkillSuggestions
    && trimmedSkillQuery.length >= 2
    && skillSuggestions.length > 0;
  const trimmedLanguageQuery = langName.trim();
  const shouldShowLanguageSuggestions = showLanguageSuggestions
    && trimmedLanguageQuery.length >= 2
    && languageSuggestions.length > 0;
  const canAddLanguage = Boolean(selectedLanguageName || resolveStoredCvLanguageName(langName));

  useEffect(() => {
    if (!shouldShowLanguageSuggestions) {
      setActiveLanguageSuggestionIndex(-1);
      return;
    }

    setActiveLanguageSuggestionIndex((currentIndex) => {
      if (languageSuggestions.length === 0) return -1;
      if (currentIndex >= 0 && currentIndex < languageSuggestions.length) return currentIndex;
      return 0;
    });
  }, [languageSuggestions.length, shouldShowLanguageSuggestions]);

  useEffect(() => {
    if (activeLanguageSuggestionIndex < 0) return;
    langSuggestionRefs.current[activeLanguageSuggestionIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeLanguageSuggestionIndex]);

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";
  const textareaClass = "w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-y";
  const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";
  const btnSecondary = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t.cv.title}</h1>
                <div className="flex items-center gap-3">
                  {/* "Draft saved" indicator — appears briefly after autosave */}
                  {lastCvSavedAt > 0 && Date.now() - lastCvSavedAt < 3000 && (
                    <span className="text-xs text-muted-foreground animate-pulse" key={lastCvSavedAt}>
                      {t.cv.draftSaved || 'Draft saved'}
                    </span>
                  )}
                  <button onClick={() => setShowPreview(!showPreview)} className={btnSecondary}>
                    <Eye className="h-4 w-4" />{showPreview ? t.cv.edit : t.cv.preview}
                  </button>
                  <button onClick={handleSave} className={btnPrimary}>
                    {t.common.save}
                  </button>
                </div>
              </div>

            {/* Steps Navigation - Responsive Scrollable Chips */}
              <div className="mb-8 flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide scroll-smooth">
              {steps.map((s, i) => (
                <button 
                  key={i} 
                  ref={element => {
                    stepButtonRefs.current[i] = element;
                  }}
                  onClick={() => setStep(i)}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                    step === i 
                      ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background' 
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

              {/* Subtle upgrade banner — only shown to free users */}
              {!isPro && (
                <UpgradeBuilderBanner />
              )}

              {showPreview ? (
                      <div>
                          <div className="mb-4 flex gap-2 flex-wrap items-center">
                          {/* Download dropdown */}
                          <div className="relative" ref={downloadMenuRef}>
                            <button
                              onClick={() => setShowDownloadMenu(v => !v)}
                              className={btnPrimary + ' flex items-center gap-1'}
                              disabled={isPdfExporting || isWordExporting}
                            >
                              <Download className="h-4 w-4" />
                              {isPdfExporting || isWordExporting ? '...' : t.cv.downloadCv}
                              <ChevronDown className="h-3 w-3 ml-0.5" />
                            </button>
                            {showDownloadMenu && (
                              <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                                <button
                                  onClick={() => handlePDFDownload('cv-preview')}
                                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                                  disabled={isPdfExporting}
                                >
                                  <File className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                  <div>
                                    <div className="font-semibold text-sm">{t.cv.downloadPdf}</div>
                                    <div className="text-xs text-muted-foreground">{t.cv.downloadPdfDesc}</div>
                                  </div>
                                </button>
                                <button
                                  onClick={handleDOCXDownload}
                                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-t border-border"
                                  disabled={isWordExporting}
                                >
                                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                  <div>
                                    <div className="font-semibold text-sm">{t.cv.downloadDocx}</div>
                                    <div className="text-xs text-muted-foreground">{t.cv.downloadDocxDesc}</div>
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                          <div key={`diag-preview-${exportDiagTick}`}>
                            <CvExportCopyDiagnosticsButton />
                          </div>
                          <button onClick={() => { exportToClipboard('cv-preview'); toast.success(t.cv.copied); }} className={btnSecondary}>
                            <Copy className="h-4 w-4" />{t.cv.copy}
                          </button>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">{t.cv.downloadNote}</p>
                  <div id="cv-preview" className="overflow-auto rounded-xl border border-border shadow-lg">
                    {TemplateComponent && (
                      <TemplateComponent
                        key={`${cv.templateId}-${photoForCurrentTemplate?.slice(-20) ?? 'no-photo'}`}
                        data={localizedPreviewCv}
                        locale={locale}
                      />
                    )}
                  </div>
                </div>
              ) : (
              <div className="rounded-xl border border-border bg-card p-6">
                {/* Step 0: Personal */}
                  {step === 0 && (
                    <div className="space-y-4">
                      <div className="mb-4">
                        <label className="mb-1.5 block text-sm font-medium">{t.cv.region}</label>
                        <select value={cv.region} onChange={e => {
                          const region = e.target.value as Region;
                          commitCvUpdate(prev => ({
                            ...prev,
                            region,
                            templateId: region === 'Japan' ? 'rirekisho' : (prev.templateId === 'rirekisho' ? 'modern-minimal' : prev.templateId),
                          }));
                        }} className={inputClass}>
                            <option value="US">{t.cv.regions.us}</option>
                            <option value="EU">{t.cv.regions.eu}</option>
                            <option value="Balkan">{t.cv.regions.balkan}</option>
                            <option value="MiddleEast">{t.cv.regions.middleEast}</option>
                  <option value="India">{t.cv.regions.india}</option>
                  <option value="Japan">{t.cv.regions.japan}</option>
                            </select>
                      </div>
                      <PhotoUpload
                        photo={cv.personal.photo}
                        photoEnabled={cv.personal.photoEnabled}
                        region={cv.region}
                        isPro={isPro}
                        photoShape={RECT_PHOTO_TEMPLATES.includes(cv.templateId) ? 'rectangle' : 'circle'}
                        onChange={handlePhotoChange}
                        onUpgradeRequest={() => setProTemplateModal(true)}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.fullName}</label><input value={cv.personal.fullName} onChange={e => updatePersonal('fullName', e.target.value)} className={inputClass} placeholder={t.cv.fullNamePlaceholder} /></div>
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.jobTitle}</label><input value={cv.personal.jobTitle} onChange={e => updatePersonal('jobTitle', e.target.value)} className={inputClass} placeholder={t.cv.jobTitlePlaceholder} /></div>
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.email}</label><input type="email" value={cv.personal.email} onChange={e => updatePersonal('email', e.target.value)} className={inputClass} /></div>
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.phone}</label><input value={cv.personal.phone} onChange={e => updatePersonal('phone', e.target.value)} className={inputClass} /></div>
                        <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium">{t.cv.address}</label><input value={cv.personal.address} onChange={e => updatePersonal('address', e.target.value)} className={inputClass} /></div>
                      </div>
                        {cv.region === 'India' && (
                          <div className="grid gap-4 sm:grid-cols-2 mt-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                            <div><label className="mb-1.5 block text-sm font-medium">{t.cv.fathersName}</label><input value={cv.personal.fathersName || ''} onChange={e => updatePersonal('fathersName', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1.5 block text-sm font-medium">{t.cv.nationality}</label><input value={cv.personal.nationality || ''} onChange={e => updatePersonal('nationality', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1.5 block text-sm font-medium">{t.cv.dateOfBirth}</label><input value={cv.personal.dateOfBirth || ''} onChange={e => updatePersonal('dateOfBirth', e.target.value)} className={inputClass} placeholder="DD/MM/YYYY" /></div>
                          </div>
                        )}
                        {cv.region === 'Japan' && (
                          <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-4 space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-sm font-medium">{t.cv.dateOfBirth} <span className="text-muted-foreground text-xs">(YYYY/MM/DD)</span></label>
                                <input
                                  value={cv.personal.dateOfBirth || ''}
                                  onChange={e => updatePersonal('dateOfBirth', e.target.value)}
                                  className={inputClass}
                                  placeholder="例: 1990/04/15"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-sm font-medium">{t.cv.gender || '性別'}</label>
                                <div className="flex gap-4 h-10 items-center">
                                  {[
                                    { val: '男', label: t.cv.genderMale || '男' },
                                    { val: '女', label: t.cv.genderFemale || '女' },
                                    { val: 'その他', label: t.cv.genderOther || 'その他' },
                                  ].map(({ val, label }) => (
                                    <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                      <input
                                        type="radio"
                                        name="gender"
                                        value={val}
                                        checked={cv.personal.gender === val}
                                        onChange={() => updatePersonal('gender', val)}
                                        className="accent-primary"
                                      />
                                      {label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Gender field for all non-Japan regions */}
                        {cv.region !== 'Japan' && (
                          <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                            <label className="mb-2 block text-sm font-medium">{t.cv.gender}</label>
                            <div className="flex gap-6 h-10 items-center">
                              {[
                                { val: 'male', label: t.cv.genderMale },
                                { val: 'female', label: t.cv.genderFemale },
                              ].map(({ val, label }) => (
                                <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="radio"
                                    name="gender-general"
                                    value={val}
                                    checked={cv.personal.gender === val}
                                    onChange={() => updatePersonal('gender', val)}
                                    className="accent-primary"
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                {/* Step 1: Experience */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]" style={{backgroundImage:'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 60%)'}}>
                      <p className="text-sm font-semibold text-[#d4aa50]">{t.cv.aiExperienceIntro}</p>
                      <p className="mt-0.5 text-xs text-[#7a8499] leading-snug">{t.cv.aiExperienceIntroSub}</p>
                    </div>
                    {cv.experience.map((exp, idx) => (
                      <div key={exp.id} className="rounded-lg border border-border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">#{idx + 1}</span>
                            <button onClick={() => removeExperience(exp.id)} className="text-destructive hover:underline text-xs"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.position}</label><input value={exp.position} onChange={e => updateExperience(exp.id, 'position', e.target.value)} className={inputClass} /></div>
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.company}</label><input value={exp.company} onChange={e => updateExperience(exp.id, 'company', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1 block text-xs font-medium">{t.cv.startDate}</label><MonthPicker value={exp.startDate} onChange={val => updateExperience(exp.id, 'startDate', val)} locale={locale} templateId={cv.templateId} /></div>
                            <div>
                              <label className="mb-1 block text-xs font-medium">{t.cv.endDate}</label>
                              <div className="flex items-center gap-2">
                                <MonthPicker value={exp.endDate} onChange={val => updateExperience(exp.id, 'endDate', val)} locale={locale} templateId={cv.templateId} disabled={exp.isPresent} className="flex-1" />
                                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                  <input type="checkbox" checked={exp.isPresent} onChange={e => updateExperience(exp.id, 'isPresent', e.target.checked)} className="rounded" />
                                  {t.cv.present}
                                </label>
                              </div>
                            </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">{t.cv.description}</label>
                          <textarea
                            data-experience-description-id={exp.id}
                            value={exp.description}
                            onChange={e => updateExperience(exp.id, 'description', e.target.value)}
                            aria-invalid={Boolean(experienceDescriptionLocalizationLimitViolation(exp.description))}
                            aria-describedby={`experience-description-limit-${exp.id}`}
                            className={textareaClass}
                          />
                          {experienceDescriptionLocalizationLimitViolation(exp.description) && (
                            <p
                              id={`experience-description-limit-${exp.id}`}
                              role="alert"
                              className="mt-1 text-xs text-amber-500"
                            >
                              {EXPERIENCE_LOCALIZATION_LIMIT_MESSAGE[locale]} ({EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS})
                            </p>
                          )}
                        </div>
                        {/* AI Improvements panel */}
                        <div className="rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] p-4 space-y-3 shadow-[0_4px_20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)]" style={{backgroundImage:'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 50%)'}}>
                          <p className="text-xs font-bold tracking-[0.08em] text-[#d4aa50] flex items-center gap-1.5 uppercase">
                            <Sparkles className="h-3.5 w-3.5 text-[#d4aa50]" />{t.cv.aiBullets}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.cv.industryLabel}</label>
                              <select
                                value={expIndustry[exp.id] ?? 'general'}
                                onChange={e => setExpIndustry(prev => ({ ...prev, [exp.id]: e.target.value as BulletIndustry }))}
                                className={inputClass + ' h-9 text-xs'}
                              >
                                {industryOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {t.cv.industries[opt.value as keyof typeof t.cv.industries]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.cv.levelLabel}</label>
                              <select
                                value={expLevel[exp.id] ?? 'mid'}
                                onChange={e => setExpLevel(prev => ({ ...prev, [exp.id]: e.target.value as BulletLevel }))}
                                className={inputClass + ' h-9 text-xs'}
                              >
                                {levelOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {t.cv.bulletLevels[opt.value as keyof typeof t.cv.bulletLevels]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <PremiumAIButton
                            onClick={() => handleGenBullets(exp.id)}
                            disabled={Boolean(generatingBulletsId)}
                            className="w-full"
                            icon={Wand2}
                            label={generatingBulletsId === exp.id ? t.common.loading : t.cv.aiBullets}
                            subtitle={generatingBulletsId === exp.id ? undefined : t.cv.aiBulletsSubtext}
                            showArrow
                          />
                          {INTERNAL_AI_RESET_ENABLED ? <ExperienceAiCopyDiagnosticsButton /> : null}
                        </div>
                      </div>
                    ))}
                    <button onClick={addExperience} className={btnSecondary}><Plus className="h-4 w-4" />{t.cv.addMore}</button>
                  </div>
                )}

                {/* Step 2: Education */}
                {step === 2 && (
                  <div className="space-y-6">
                    {cv.education.map((edu, idx) => (
                      <div key={edu.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">#{idx + 1}</span>
                          <button onClick={() => removeEducation(edu.id)} className="text-destructive hover:underline text-xs"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.degree}</label><input value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} className={inputClass} /></div>
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.school}</label><input value={edu.school} onChange={e => updateEducation(edu.id, 'school', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1 block text-xs font-medium">{t.cv.startDate}</label><MonthPicker value={edu.startDate} onChange={val => updateEducation(edu.id, 'startDate', val)} locale={locale} templateId={cv.templateId} /></div>
                            <div><label className="mb-1 block text-xs font-medium">{t.cv.endDate}</label><MonthPicker value={edu.endDate} onChange={val => updateEducation(edu.id, 'endDate', val)} locale={locale} templateId={cv.templateId} /></div>
                        </div>
                      </div>
                    ))}
                    <button onClick={addEducation} className={btnSecondary}><Plus className="h-4 w-4" />{t.cv.addMore}</button>
                  </div>
                )}

                {/* Step 3: Skills & Languages */}
                {step === 3 && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="font-semibold mb-3">{t.cv.skills}</h3>
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div ref={skillAutocompleteRef} className="relative min-w-0 flex-1">
                          <input
                            ref={skillInputRef}
                            value={skillInput}
                            onChange={e => {
                              const nextValue = e.target.value;
                              setSkillInput(nextValue);
                              setShowSkillSuggestions(nextValue.trim().length >= 2);
                            }}
                            onFocus={() => setShowSkillSuggestions(trimmedSkillQuery.length >= 2)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSkill();
                              }

                              if (e.key === 'Escape') {
                                setShowSkillSuggestions(false);
                              }
                            }}
                            autoComplete="off"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-controls="cv-skill-suggestions"
                            aria-expanded={shouldShowSkillSuggestions}
                            aria-haspopup="listbox"
                            className={inputClass + ' min-h-11'}
                            placeholder={t.cv.skillPlaceholder}
                          />
                          {shouldShowSkillSuggestions && (
                            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                              <div
                                id="cv-skill-suggestions"
                                role="listbox"
                                className="max-h-72 overflow-y-auto overscroll-contain py-1"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                              >
                                {skillSuggestions.map((option) => (
                                  <button
                                    key={option.canonicalName}
                                    type="button"
                                    onClick={() => addSkill(option)}
                                    className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-foreground"
                                  >
                                    {option.localizedLabel}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button onClick={() => addSkill()} className={btnSecondary + ' min-h-11 w-full justify-center sm:w-auto'}><Plus className="h-4 w-4" /></button>
                      </div>
                      {cv.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {cv.skills.map((s, i) => {
                            const cat = getSkillCategory(s);
                            return (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                                  cat === 'soft'
                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                {getLocalizedCvSkillName(s, locale)}
                                <button onClick={() => removeSkill(i)} className="hover:text-destructive ml-0.5"><Trash2 className="h-3 w-3" /></button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {smartSkillSuggestions.length > 0 && (
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
                          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            {t.cv.suggestedSkills || 'Suggested Skills'}
                          </p>
                          {(() => {
                            const techSuggestions = smartSkillSuggestions.filter(o => o.category === 'technical');
                            const softSuggestions = smartSkillSuggestions.filter(o => o.category === 'soft');
                            const renderSuggestionChips = (options: CvSkillOption[]) => (
                              <div className="flex flex-wrap gap-2">
                                {options.map((option) => (
                                  <button
                                    key={option.canonicalName}
                                    type="button"
                                    onClick={() => {
                                      setCv((prev) => {
                                        const normalized = option.canonicalName.trim().toLocaleLowerCase();
                                        if (prev.skills.some((s) => (resolveStoredCvSkillName(s) ?? s).trim().toLocaleLowerCase() === normalized)) return prev;
                                        return { ...prev, skills: [...prev.skills, option.canonicalName] };
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                                  >
                                    <Plus className="h-3 w-3" />
                                    {option.localizedLabel}
                                  </button>
                                ))}
                              </div>
                            );
                            return (
                              <div className="space-y-3">
                                {techSuggestions.length > 0 && (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.cv.skillCategories?.technical || 'Technical Skills'}</p>
                                    {renderSuggestionChips(techSuggestions)}
                                  </div>
                                )}
                                {softSuggestions.length > 0 && (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.cv.skillCategories?.soft || 'Soft Skills'}</p>
                                    {renderSuggestionChips(softSuggestions)}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">{t.cv.certifications}</h3>
                      <div className="flex gap-2 mb-3">
                        <input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCert()} className={inputClass} placeholder={t.cv.certPlaceholder} />
                        <button onClick={addCert} className={btnSecondary}><Plus className="h-4 w-4" /></button>
                      </div>
                      <div className="space-y-1">
                        {cv.certifications.map((c, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            {c}
                            <button onClick={() => setCv(prev => ({ ...prev, certifications: prev.certifications.filter((_, idx) => idx !== i) }))} className="text-destructive hover:underline"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">{t.cv.languages}</h3>
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div ref={langAutocompleteRef} className="relative min-w-0 flex-1">
                          <div
                            className="flex min-h-11 w-full cursor-text items-center rounded-lg border border-input bg-background px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                            onPointerDown={(event) => {
                              if (event.target !== langInputRef.current) {
                                event.preventDefault();
                              }

                              focusLanguageInput();
                            }}
                          >
                            <input
                              ref={langInputRef}
                              value={langName}
                              onChange={e => {
                                const nextValue = e.target.value;
                                setLangName(nextValue);
                                setSelectedLanguageName(null);
                                setShowLanguageSuggestions(nextValue.trim().length >= 2);
                              }}
                              onFocus={() => setShowLanguageSuggestions(trimmedLanguageQuery.length >= 2)}
                              onKeyDown={e => {
                                if (e.key === 'ArrowDown' && shouldShowLanguageSuggestions) {
                                  e.preventDefault();
                                  setActiveLanguageSuggestionIndex((currentIndex) => Math.min(languageSuggestions.length - 1, currentIndex + 1));
                                }

                                if (e.key === 'ArrowUp' && shouldShowLanguageSuggestions) {
                                  e.preventDefault();
                                  setActiveLanguageSuggestionIndex((currentIndex) => Math.max(0, currentIndex - 1));
                                }

                                if (e.key === 'Enter') {
                                  e.preventDefault();

                                  if (shouldShowLanguageSuggestions && activeLanguageSuggestionIndex >= 0) {
                                    selectLanguageSuggestion(languageSuggestions[activeLanguageSuggestionIndex]);
                                    return;
                                  }

                                  addLanguage();
                                }

                                if (e.key === 'Escape') {
                                  setShowLanguageSuggestions(false);
                                  setActiveLanguageSuggestionIndex(-1);
                                }
                              }}
                              autoComplete="off"
                              role="combobox"
                              aria-autocomplete="list"
                              aria-controls="cv-language-suggestions"
                              aria-expanded={shouldShowLanguageSuggestions}
                              aria-haspopup="listbox"
                              aria-activedescendant={activeLanguageSuggestionIndex >= 0 ? `cv-language-suggestion-${languageSuggestions[activeLanguageSuggestionIndex]?.code}` : undefined}
                              className="h-11 w-full min-w-0 border-0 bg-transparent px-0 text-sm outline-none placeholder:text-muted-foreground"
                              placeholder={t.cv.langPlaceholder}
                            />
                          </div>
                          {shouldShowLanguageSuggestions && (
                            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                              <div
                                id="cv-language-suggestions"
                                role="listbox"
                                className="max-h-72 overflow-y-auto overscroll-contain py-1"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                              >
                                {languageSuggestions.map((option, index) => (
                                  <button
                                    key={option.code}
                                    id={`cv-language-suggestion-${option.code}`}
                                    ref={(element) => {
                                      langSuggestionRefs.current[index] = element;
                                    }}
                                    type="button"
                                    onClick={() => selectLanguageSuggestion(option)}
                                    onMouseEnter={() => setActiveLanguageSuggestionIndex(index)}
                                    className={`flex min-h-11 w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-foreground ${activeLanguageSuggestionIndex === index ? 'bg-accent text-foreground' : ''}`}
                                  >
                                    {option.localizedLabel}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex w-full gap-3 sm:w-auto sm:flex-none">
                          <select
                            value={langLevel}
                            onChange={e => setLangLevel(e.target.value)}
                            className={inputClass + ' min-h-11 flex-1 sm:w-52 sm:flex-none'}
                          >
                            <option value="">{t.cv.levelPlaceholder}</option>
                            <option value="native">{t.cv.levels.native}</option>
                            <option value="fluent">{t.cv.levels.fluent}</option>
                            <option value="advanced">{t.cv.levels.advanced}</option>
                            <option value="intermediate">{t.cv.levels.intermediate}</option>
                            <option value="basic">{t.cv.levels.basic}</option>
                          </select>
                          <button
                            onClick={() => addLanguage()}
                            disabled={!canAddLanguage}
                            className={btnSecondary + ' min-h-11 min-w-11 shrink-0 justify-center px-3 disabled:cursor-not-allowed disabled:opacity-50'}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {cv.languages.map((l, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            {getLocalizedCvLanguageName(l.name, locale)} - {localizeCvLanguageLevel(l.level, locale)}
                            <button onClick={() => setCv(prev => applyCanonicalSkillsLanguagesEducationEdit(prev, {
                              languages: prev.languages.filter((_, idx) => idx !== i),
                            }))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Summary */}
                {step === 4 && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]" style={{backgroundImage:'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 60%)'}}>
                      <p className="text-sm font-semibold text-[#d4aa50]">{t.cv.aiSummaryIntro}</p>
                      <p className="mt-0.5 text-xs text-[#7a8499] leading-snug">{t.cv.aiSummaryIntroSub}</p>
                    </div>
                    <PremiumAIButton
                      onClick={handleGenSummary}
                      disabled={isSummaryGenerating}
                      icon={Sparkles}
                      label={isSummaryGenerating ? t.common.loading : t.cv.generate}
                      subtitle={isSummaryGenerating ? undefined : t.cv.generateSubtext}
                      showArrow
                    />
                    {INTERNAL_AI_RESET_ENABLED ? <SummaryAiCopyDiagnosticsButton /> : null}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground/60">{t.cv.rewrite}:</p>
                      <div className="space-y-2">
                        {(['shorter', 'stronger', 'professional'] as const).map(style => (
                          <PremiumAIButton
                            key={style}
                            onClick={() => handleRewrite(style)}
                            disabled={!!rewritingStyle}
                            icon={Wand2}
                            label={rewritingStyle === style ? t.common.loading : (style === 'shorter' ? t.cv.short : style === 'stronger' ? t.cv.strong : t.cv.professional)}
                            subtitle={rewritingStyle === style ? undefined : (style === 'shorter' ? t.cv.shorterSubtext : style === 'stronger' ? t.cv.strongerSubtext : t.cv.professionalSubtext)}
                            badge={!isPro ? <ProBadge /> : undefined}
                            showArrow
                          />
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={cv.summary}
                      onChange={e => setCv(prev => applyCanonicalSummaryEdit(prev, e.target.value, locale))}
                      className={textareaClass + ' min-h-[180px]'}
                      placeholder={t.cv.summaryPlaceholder}
                    />
                      <div className="border-t border-border pt-4 mt-4 space-y-3">
                        <h4 className="font-semibold text-sm">{t.cv.analyzeJob}</h4>
                        {!isPro ? (
                          <PremiumAIButton
                            onClick={() => setJobAnalyzerModal(true)}
                            icon={Search}
                            label={t.cv.analyzeJob}
                            subtitle={t.cv.analyzeJobSubtext}
                            hint={t.cv.proHint}
                            badge={<ProBadge />}
                            showArrow
                          />
                          ) : (
                            <>
                              <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} className={textareaClass} placeholder={t.cv.jobDescPlaceholder} />
                              <PremiumAIButton
                                onClick={handleAnalyzeJob}
                                className="mt-2"
                                icon={Search}
                                label={t.cv.analyzeJob}
                                subtitle={t.cv.analyzeJobSubtext}
                                hint={t.cv.proHint}
                                badge={<ProBadge />}
                                showArrow
                              />

                            {isAnalyzing && <JobAnalysisLoadingState />}
                            {showAnalysis && analysis && !isAnalyzing && (
                              <JobAnalysisResultScreen
                                result={analysis}
                                isPro={isPro}
                                onClose={() => { setShowAnalysis(false); setAnalysis(null); }}
                              />
                            )}
                          </>
                        )}
                      </div>
                  </div>
                )}

                {/* Step 5: Template Selection */}
                  {step === 5 && (
                    <div>
                      <div className="mb-4 space-y-3">
                        <h3 className="font-semibold">{t.cv.selectTemplate}</h3>
                        <PremiumAIButton
                          onClick={handleTemplateRecommend}
                          icon={Sparkles}
                          label={t.cv.aiRecommend}
                          subtitle={t.cv.aiRecommendSubtext}
                          showArrow
                        />
                      </div>
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        {(Object.entries(templateInfo) as [TemplateId, typeof templateInfo[TemplateId]][]).map(([id, info]) => {
                          const translated = t.templates.items[id];
                          const isSelected = cv.templateId === id;
                          const isRecommended = recommendedTemplateId === id;
                          const categoryKey = info.category.toLowerCase().replace('-friendly', '').replace('japanese', 'japanese') as keyof typeof t.templates.categories;
                          const translatedCategory = translated?.category || t.templates.categories[categoryKey] || info.category;
                          return (
                            <div
                              key={id}
                              className={`group rounded-xl border-2 transition-all overflow-hidden flex flex-col ${isSelected ? 'border-primary shadow-md' : isRecommended ? 'border-amber-400 shadow-md' : 'border-border hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5'}`}
                            >
                              {/* Visual preview area — tap to open fullscreen */}
                              <div className="relative aspect-[210/297] w-full bg-muted/30 overflow-hidden shrink-0">
                                {info.isPro && (
                                  <div className="absolute top-2 end-2 z-10 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md">
                                    <Crown className="h-2.5 w-2.5" />
                                    {t.templates.proBadge}
                                  </div>
                                )}
                                {isRecommended && (
                                  <div className="absolute top-2 start-2 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-md">
                                    <Star className="h-2.5 w-2.5 fill-amber-900" />
                                    {t.cv.recommendedForYou}
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute inset-0 border-2 border-primary rounded-[0.6rem] pointer-events-none z-20" />
                                )}
                                <button
                                  type="button"
                                  aria-label={`${t.cv.preview}: ${translated?.name || info.name}`}
                                  onClick={() => setFullscreenTemplateId(id)}
                                  className="absolute inset-0 z-[15] flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                                >
                                  <div className="absolute inset-0 p-0.5 sm:p-1.5 transition-transform duration-300 ease-out group-hover:scale-[1.02]">
                                    <TemplatePreview templateId={id} lazy maxScale={0.72} />
                                  </div>
                                  <span className="absolute bottom-2 end-2 z-20 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                                    <Maximize2 className="h-3 w-3" />
                                    {t.cv.preview}
                                  </span>
                                </button>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
                              </div>
                              {/* Card info — tap to select template */}
                              <button
                                type="button"
                                onClick={() => handleTemplateSelect(id)}
                                className={`p-3 border-t border-border flex flex-col gap-1 flex-1 min-w-0 text-start w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${isSelected ? 'bg-primary/5' : 'bg-card hover:bg-muted/30'}`}
                              >
                                <div className="flex items-center justify-between gap-1 min-w-0">
                                  <h4 className="text-xs font-bold text-foreground leading-tight truncate">{translated?.name || info.name}</h4>
                                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary whitespace-nowrap shrink-0">
                                    {translatedCategory}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed min-w-0">
                                  {translated?.description || info.description}
                                </p>
                                {isRecommended && (
                                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                                    {info.isPro ? t.cv.optimizedForProfile : t.cv.bestResultsTemplate}
                                  </p>
                                )}
                                {info.isPro && !isPro && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Lock className="h-2.5 w-2.5 text-primary/60 shrink-0" />
                                    <span className="text-[9px] text-primary/70 font-medium">{t.cv.unlockWithPro}</span>
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                        {/* Step 6: Preview */}
                        {step === 6 && (
                          <div>
                                <div className="mb-4 flex gap-2 flex-wrap items-center">
                                  {/* Download dropdown */}
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowDownloadMenu(v => !v)}
                                      className={btnPrimary + ' flex items-center gap-1'}
                                      disabled={isPdfExporting || isWordExporting}
                                    >
                                      <Download className="h-4 w-4" />
                                      {isPdfExporting || isWordExporting ? '...' : t.cv.downloadCv}
                                      <ChevronDown className="h-3 w-3 ml-0.5" />
                                    </button>
                                    {showDownloadMenu && (
                                      <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                                        <button
                                          onClick={() => handlePDFDownload('cv-inline-preview')}
                                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                                          disabled={isPdfExporting}
                                        >
                                          <File className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                          <div>
                                            <div className="font-semibold text-sm">{t.cv.downloadPdf}</div>
                                            <div className="text-xs text-muted-foreground">{t.cv.downloadPdfDesc}</div>
                                          </div>
                                        </button>
                                        <button
                                          onClick={handleDOCXDownload}
                                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-t border-border"
                                          disabled={isWordExporting}
                                        >
                                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                          <div>
                                            <div className="font-semibold text-sm">{t.cv.downloadDocx}</div>
                                            <div className="text-xs text-muted-foreground">{t.cv.downloadDocxDesc}</div>
                                          </div>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div key={`diag-inline-${exportDiagTick}`}>
                                    <CvExportCopyDiagnosticsButton />
                                  </div>
                                <button onClick={() => { exportToClipboard('cv-inline-preview'); toast.success(t.cv.copied); }} className={btnSecondary}>
                                  <Copy className="h-4 w-4" />{t.cv.copy}
                                </button>
                              </div>
                        <div id="cv-inline-preview" className="overflow-auto rounded-xl border border-border shadow-lg">
                          {TemplateComponent && (
                            <TemplateComponent
                              key={`${cv.templateId}-${photoForCurrentTemplate?.slice(-20) ?? 'no-photo'}`}
                              data={localizedPreviewCv}
                              locale={locale}
                            />
                          )}
                        </div>
                      </div>
                    )}

                {/* Navigation */}
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className={btnSecondary + ' disabled:opacity-30'}>
                    <ChevronLeft className="h-4 w-4" />{t.common.back}
                  </button>
                  <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1} className={btnPrimary + ' disabled:opacity-30'}>
                    {t.common.next}<ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
        </main>
      <Footer />
      <FreeLimitModal
        open={limitModal.open}
        type={limitModal.type}
        onClose={() => setLimitModal(prev => ({ ...prev, open: false }))}
      />
      <JobAnalyzerProModal
        open={jobAnalyzerModal}
        onClose={() => setJobAnalyzerModal(false)}
      />
      <AiImprovementsProModal
        open={aiImprovementsModal}
        onClose={() => setAiImprovementsModal(false)}
      />
      <SummaryAiProModal
        open={summaryAiModal}
        onClose={() => setSummaryAiModal(false)}
      />
      <ProTemplateModal
        open={proTemplateModal}
        onClose={() => setProTemplateModal(false)}
      />
      <AiRecommendProModal
        open={aiRecommendModal}
        onClose={() => setAiRecommendModal(false)}
      />
      <TemplatePreviewFullscreenModal
        open={fullscreenTemplateId !== null}
        templateId={fullscreenTemplateId}
        templateName={
          fullscreenTemplateId
            ? (t.templates.items[fullscreenTemplateId]?.name || templateInfo[fullscreenTemplateId].name)
            : ''
        }
        selectLabel={t.cv.selectTemplate}
        previewLabel={t.cv.preview}
        onClose={() => setFullscreenTemplateId(null)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}
