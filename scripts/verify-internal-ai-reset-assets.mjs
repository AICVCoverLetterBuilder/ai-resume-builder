#!/usr/bin/env node
/**
 * Verify internal AI reset markers in a static export / Capacitor assets tree.
 *
 * Usage:
 *   node scripts/verify-internal-ai-reset-assets.mjs --dir out --expect enabled
 *   node scripts/verify-internal-ai-reset-assets.mjs --dir android/app/src/main/assets/public --expect enabled
 *   node scripts/verify-internal-ai-reset-assets.mjs --dir out --expect disabled
 */
import fs from 'node:fs';
import path from 'node:path';

const MARKER = 'CVPRO_INTERNAL_AI_RESET_ENABLED_V1';
const RESET_BUTTON = 'Reset AI test usage';
const CHANNEL_LABEL = 'Build channel: internal';
const STATUS_LABEL = 'AI test reset: enabled';

const EXPERIENCE_AI_TRACE_MARKER = 'CVPRO_EXPERIENCE_AI_TRACE_V1';
const EXPERIENCE_AI_COPY = 'Copy Experience AI diagnostics';
const EXPERIENCE_AI_FIELD_FAILURE = 'finalTypedFailureReason';
const EXPERIENCE_AI_FIELD_SOURCE = 'selectedSourceKind';
const EXPERIENCE_AI_FIELD_FALLBACK = 'fallbackCoveredFactCount';
const SUMMARY_AI_TRACE_MARKER = 'CVPRO_SUMMARY_AI_TRACE_V1';
const SUMMARY_AI_COPY = 'Copy Summary AI diagnostics';

function fail(msg) {
  console.error(`[verify-internal-ai-reset] FAIL: ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[verify-internal-ai-reset] ${msg}`);
}

function collectTextFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTextFiles(full, out);
    else if (/\.(js|html|txt|css|json)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function readAll(dir) {
  const files = collectTextFiles(dir);
  let blob = '';
  for (const f of files) {
    try {
      blob += fs.readFileSync(f, 'utf8');
      blob += '\n';
    } catch {
      /* ignore binary/unreadable */
    }
  }
  return { files: files.length, blob };
}

function parseArgs(argv) {
  let dir = '';
  let expect = '';
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dir') dir = argv[++i] || '';
    else if (argv[i] === '--expect') expect = argv[++i] || '';
  }
  return { dir, expect };
}

const { dir, expect } = parseArgs(process.argv);
if (!dir || (expect !== 'enabled' && expect !== 'disabled')) {
  fail('usage: --dir <path> --expect enabled|disabled');
}
const abs = path.resolve(dir);
if (!fs.existsSync(abs)) fail(`directory missing: ${abs}`);

const { files, blob } = readAll(abs);
log(`scanned ${files} files under ${abs}`);

const hasMarker = blob.includes(MARKER);
const hasButton = blob.includes(RESET_BUTTON);
const hasChannel = blob.includes(CHANNEL_LABEL);
const hasStatus = blob.includes(STATUS_LABEL);

const SUMMARY_RUNTIME_REVISION_HI = 'summary-runtime-281-v1';
const SUMMARY_RUNTIME_REVISION = 'summary-runtime-282-v1';
const SUMMARY_SPLITTER_REVISION = 'hindi-three-sentence-slots-v3';
const SUMMARY_GROUNDING_REVISION = 'entry-owned-grounding-v3';
const SUMMARY_DURATION_REVISION = 'duration-idempotent-v3';
const SUMMARY_BUILDER_REVISION = 'live-hindi-material-rebuild-v3';
const SUMMARY_SPLITTER_REVISION_AR = 'arabic-three-sentence-slots-v1';
const SUMMARY_GROUNDING_REVISION_AR = 'entry-owned-arabic-grounding-v1';
const SUMMARY_DURATION_REVISION_AR = 'arabic-duration-idempotent-v1';
const SUMMARY_BUILDER_REVISION_AR = 'entry-owned-arabic-rebuild-v1';
const ARABIC_MODERN_MINIMAL_PDF_RTL = 'arabic-modern-minimal-pdf-rtl-283-v1';
const RUSSIAN_EXPERIENCE_MATERIAL = 'russian-experience-material-v1';
const SUMMARY_SPLITTER_REVISION_RU = 'russian-three-sentence-slots-v1';
const SUMMARY_GROUNDING_REVISION_RU = 'entry-owned-russian-grounding-v1';
const SUMMARY_DURATION_REVISION_RU = 'russian-duration-idempotent-v1';
const SUMMARY_BUILDER_REVISION_RU = 'entry-owned-russian-rebuild-v1';
const RUSSIAN_DESIGN_FAMILIES = 'russian-design-families-286-v1';
const RUSSIAN_DESIGN_FALLBACK_ROUTING = 'russian-design-fallback-routing-287-v1';
const JAPANESE_EXPERIENCE_MATERIAL = 'japanese-experience-material-v1';
const SUMMARY_SPLITTER_REVISION_JA = 'japanese-three-sentence-slots-v1';
const SUMMARY_GROUNDING_REVISION_JA = 'entry-owned-japanese-grounding-v1';
const SUMMARY_DURATION_REVISION_JA = 'japanese-duration-idempotent-v2';
const SUMMARY_DURATION_REVISION_JA_LEGACY = 'japanese-duration-idempotent-v1';
const SUMMARY_BUILDER_REVISION_JA = 'entry-owned-japanese-rebuild-v1';
const JAPANESE_DURATION_IN_INTRO = 'japanese-duration-in-intro-289-v1';
const JAPANESE_SUMMARY_STRICT_POSTCONDITIONS = 'japanese-summary-strict-postconditions-289-v1';
const CROATIAN_EXPERIENCE_MATERIAL = 'croatian-experience-material-v1';
const CROATIAN_SERBIAN_LOCALE = 'croatian-serbian-locale-discrimination-v1';
const SUMMARY_SPLITTER_REVISION_HR = 'croatian-three-sentence-slots-v1';
const SUMMARY_GROUNDING_REVISION_HR = 'entry-owned-croatian-grounding-v1';
const SUMMARY_DURATION_REVISION_HR = 'croatian-duration-idempotent-v1';
const SUMMARY_DURATION_REVISION_HR_V2 = 'croatian-duration-idempotent-v2';
const SUMMARY_BUILDER_REVISION_HR = 'entry-owned-croatian-rebuild-v1';
const CROATIAN_SUMMARY_STRICT_POSTCONDITIONS = 'croatian-summary-strict-postconditions-v1';
const CROATIAN_NOOP_USAGE = 'croatian-noop-usage-291-v1';
const CROATIAN_DESIGN_POISONED = 'croatian-design-poisoned-source-recovery-291-v1';
const CROATIAN_DESIGN_FALLBACK_ROUTING = 'croatian-design-fallback-routing-291-v1';
const CROATIAN_ROLE_AWARE_MATERIAL = 'croatian-role-aware-material-classifier-291-v1';
const CROATIAN_SUMMARY_CANONICAL_RECOVERY = 'croatian-summary-canonical-recovery-291-v1';
const CROATIAN_SUMMARY_INTRO_GRAMMAR = 'croatian-summary-intro-grammar-292-v1';
const HINDI_SUMMARY_MEDIUM_GRAMMAR_297 = 'hindi-summary-medium-grammar-297-v1';
const HINDI_SUMMARY_NOMINAL_GRAMMAR = 'hindi-summary-nominal-grammar-298-v1';
const INTERNAL_AI_DIAGNOSTICS_298 = 'internal-ai-diagnostics-298-v1';
const CV_AI_DIAGNOSTICS_V2 = 'cv-ai-diagnostics-v2';
const CV_AI_DIAGNOSTICS_V2_299 = 'cv-ai-diagnostics-v2-299-v1';
const DIAG_FIELD_HINDI_NOMINAL = 'hindiNominalExperienceFragmentDetected';
const DIAG_FIELD_HINDI_FINITE = 'hindiSentenceHasFiniteCopulaOrVerb';
const DIAG_FIELD_FINAL_MEDIUM = 'finalUnsupportedDesignMediumCount';
const DIAG_FIELD_DET_MEDIUM = 'deterministicUnsupportedDesignMediumCount';
const DIAG_FIELD_INVARIANT = 'diagnosticInvariantCheckPassed';
const DIAG_FIELD_COMPLETENESS = 'diagnosticCompletenessPassed';
const DIAG_FIELD_LINEAGE = 'candidateLineage';
const DIAG_FIELD_SENTENCE_GRAMMAR = 'hindiSentenceGrammarRecords';
const DIAG_FIELD_MEANINGFUL = 'meaningfulChangeDetected';
const DIAG_FIELD_NOOP = 'noOpDetected';
const DIAG_FIELD_CLIENT_FALLBACK = 'clientFallbackUsed';
const DIAG_FIELD_CAPACITOR_URL = 'capacitorServerUrlConfigured';
const DIAG_FIELD_API_BASE = 'apiBaseUrlConfigured';
const DIAG_FIELD_SOURCE_COMMIT_STATUS = 'sourceCommitStatus';
const DIAG_INVARIANT_ENHANCE_NOOP = 'enhance_success_without_meaningful_change';
const DIAG_INVARIANT_PROVIDER_OUTCOME = 'provider_outcome_server_fallback_mismatch';
const SUMMARY_NOOP_SUCCESS_CONTRACT_300 = 'summary-noop-success-contract-300-v1';
const SUMMARY_NOOP_TYPED_REASON = 'summary_noop_after_normalization';
const DIAGNOSTICS_LIFECYCLE_V1 = 'internal-diagnostics-lifecycle-v1';
const DIAGNOSTICS_CHANGED_EVENT = 'cvpro-cv-ai-diagnostics-changed';
const CLEAR_DIAGNOSTICS_LABEL = 'Clear diagnostics';
const CLEAR_HISTORY_LABEL = 'Clear diagnostic history';
const EXPERIENCE_AI_NOOP_RECOVERY = 'experience-ai-noop-recovery-293-v1';
const EXPERIENCE_AI_UNSUPPORTED_EXPANSION = 'experience-ai-unsupported-expansion-295-v1';
const EXPERIENCE_TITLE_PROJECTION = 'experience-title-projection-296-v1';
const EXPERIENCE_AI_DIAG_MARKER = 'EXPERIENCE_AI_DIAG_V1';
const SUMMARY_AI_DIAG_MARKER = 'SUMMARY_AI_DIAG_V1';
const EXPERIENCE_DIAGNOSTIC_MARKER_302 = 'experience-diagnostic-marker-302-v1';
const GERMAN_CV_AI_302 = 'german-cv-ai-302-v1';
const GERMAN_EXPERIENCE_GROUNDING_303 = 'german-experience-grounding-303-v1';
const SPANISH_CV_AI_305 = 'spanish-cv-ai-305-v1';
const SPANISH_SUMMARY_GROUNDING_306 = 'spanish-summary-grounding-306-v1';
const SPANISH_SUMMARY_PRIOR_SLOT_307 = 'spanish-summary-prior-slot-307-v1';
const SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307 =
  'summary-localized-failure-diagnostics-307-v1';
const SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306 =
  'summary-final-candidate-diagnostics-306-v1';
const EXPERIENCE_AI_OUTPUT_PROVENANCE_304 = 'experience-ai-output-provenance-304-v1';
const EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305 =
  'experience-diagnostics-final-candidate-305-v1';
for (const marker of [
  SUMMARY_RUNTIME_REVISION_HI,
  SUMMARY_RUNTIME_REVISION,
  SUMMARY_SPLITTER_REVISION,
  SUMMARY_GROUNDING_REVISION,
  SUMMARY_DURATION_REVISION,
  SUMMARY_BUILDER_REVISION,
  SUMMARY_SPLITTER_REVISION_AR,
  SUMMARY_GROUNDING_REVISION_AR,
  SUMMARY_DURATION_REVISION_AR,
  SUMMARY_BUILDER_REVISION_AR,
  ARABIC_MODERN_MINIMAL_PDF_RTL,
  RUSSIAN_EXPERIENCE_MATERIAL,
  SUMMARY_SPLITTER_REVISION_RU,
  SUMMARY_GROUNDING_REVISION_RU,
  SUMMARY_DURATION_REVISION_RU,
  SUMMARY_BUILDER_REVISION_RU,
  RUSSIAN_DESIGN_FAMILIES,
  RUSSIAN_DESIGN_FALLBACK_ROUTING,
  JAPANESE_EXPERIENCE_MATERIAL,
  SUMMARY_SPLITTER_REVISION_JA,
  SUMMARY_GROUNDING_REVISION_JA,
  SUMMARY_DURATION_REVISION_JA,
  SUMMARY_DURATION_REVISION_JA_LEGACY,
  SUMMARY_BUILDER_REVISION_JA,
  JAPANESE_DURATION_IN_INTRO,
  JAPANESE_SUMMARY_STRICT_POSTCONDITIONS,
  CROATIAN_EXPERIENCE_MATERIAL,
  CROATIAN_SERBIAN_LOCALE,
  SUMMARY_SPLITTER_REVISION_HR,
  SUMMARY_GROUNDING_REVISION_HR,
  SUMMARY_DURATION_REVISION_HR,
  SUMMARY_DURATION_REVISION_HR_V2,
  SUMMARY_BUILDER_REVISION_HR,
  CROATIAN_SUMMARY_STRICT_POSTCONDITIONS,
  CROATIAN_NOOP_USAGE,
  CROATIAN_DESIGN_POISONED,
  CROATIAN_DESIGN_FALLBACK_ROUTING,
  CROATIAN_ROLE_AWARE_MATERIAL,
  CROATIAN_SUMMARY_CANONICAL_RECOVERY,
  CROATIAN_SUMMARY_INTRO_GRAMMAR,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_297,
  HINDI_SUMMARY_NOMINAL_GRAMMAR,
  EXPERIENCE_AI_NOOP_RECOVERY,
  EXPERIENCE_AI_UNSUPPORTED_EXPANSION,
  EXPERIENCE_TITLE_PROJECTION,
  EXPERIENCE_AI_DIAG_MARKER,
  SUMMARY_AI_DIAG_MARKER,
  EXPERIENCE_DIAGNOSTIC_MARKER_302,
  GERMAN_CV_AI_302,
  GERMAN_EXPERIENCE_GROUNDING_303,
  SPANISH_CV_AI_305,
  SPANISH_SUMMARY_GROUNDING_306,
  SPANISH_SUMMARY_PRIOR_SLOT_307,
  SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307,
  SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306,
  EXPERIENCE_AI_OUTPUT_PROVENANCE_304,
  EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305,
]) {
  if (!blob.includes(marker)) {
    fail(`missing Summary runtime revision marker "${marker}"`);
  }
}
log('OK Summary runtime revision markers present');

if (expect === 'enabled') {
  if (!blob.includes(INTERNAL_AI_DIAGNOSTICS_298)) {
    fail(`missing internal diagnostics revision "${INTERNAL_AI_DIAGNOSTICS_298}"`);
  }
  log('OK internal-ai-diagnostics-298-v1 present');
  if (!hasMarker) fail(`missing marker ${MARKER}`);
  if (!hasButton) fail(`missing button text "${RESET_BUTTON}"`);
  if (!hasChannel) fail(`missing "${CHANNEL_LABEL}"`);
  if (!hasStatus) fail(`missing "${STATUS_LABEL}"`);
  if (!blob.includes(EXPERIENCE_AI_TRACE_MARKER)) {
    fail(`missing Experience AI marker ${EXPERIENCE_AI_TRACE_MARKER}`);
  }
  if (!blob.includes(EXPERIENCE_AI_COPY)) {
    fail(`missing "${EXPERIENCE_AI_COPY}"`);
  }
  if (!blob.includes(EXPERIENCE_AI_FIELD_FAILURE)) {
    fail(`missing field marker "${EXPERIENCE_AI_FIELD_FAILURE}"`);
  }
  if (!blob.includes(EXPERIENCE_AI_FIELD_SOURCE)) {
    fail(`missing field marker "${EXPERIENCE_AI_FIELD_SOURCE}"`);
  }
  if (!blob.includes(EXPERIENCE_AI_FIELD_FALLBACK)) {
    fail(`missing field marker "${EXPERIENCE_AI_FIELD_FALLBACK}"`);
  }
  if (!blob.includes(SUMMARY_AI_TRACE_MARKER)) {
    fail(`missing Summary AI marker ${SUMMARY_AI_TRACE_MARKER}`);
  }
  if (!blob.includes(SUMMARY_AI_COPY)) {
    fail(`missing "${SUMMARY_AI_COPY}"`);
  }
  for (const field of [
    CV_AI_DIAGNOSTICS_V2,
    CV_AI_DIAGNOSTICS_V2_299,
    DIAG_FIELD_HINDI_NOMINAL,
    DIAG_FIELD_HINDI_FINITE,
    DIAG_FIELD_FINAL_MEDIUM,
    DIAG_FIELD_DET_MEDIUM,
    DIAG_FIELD_INVARIANT,
    DIAG_FIELD_COMPLETENESS,
    DIAG_FIELD_LINEAGE,
    DIAG_FIELD_SENTENCE_GRAMMAR,
    DIAG_FIELD_MEANINGFUL,
    DIAG_FIELD_NOOP,
    DIAG_FIELD_CLIENT_FALLBACK,
    DIAG_FIELD_CAPACITOR_URL,
    DIAG_FIELD_API_BASE,
    DIAG_FIELD_SOURCE_COMMIT_STATUS,
    DIAG_INVARIANT_ENHANCE_NOOP,
    DIAG_INVARIANT_PROVIDER_OUTCOME,
    SUMMARY_NOOP_SUCCESS_CONTRACT_300,
    SUMMARY_NOOP_TYPED_REASON,
    DIAGNOSTICS_LIFECYCLE_V1,
    DIAGNOSTICS_CHANGED_EVENT,
    CLEAR_DIAGNOSTICS_LABEL,
    CLEAR_HISTORY_LABEL,
  ]) {
    if (!blob.includes(field)) {
      fail(`missing cv-ai-diagnostics-v2 field/marker "${field}"`);
    }
  }
  log('OK enabled assets contain marker, button, build-channel labels, Experience AI + Summary AI trace markers, Summary runtime revision markers, and cv-ai-diagnostics-v2 completeness fields');
} else if (hasMarker) {
  fail(`enabled marker must be absent in disabled assets (${MARKER})`);
} else if (blob.includes(EXPERIENCE_AI_TRACE_MARKER)) {
  fail(`Experience AI trace marker must be absent in disabled assets (${EXPERIENCE_AI_TRACE_MARKER})`);
} else if (blob.includes(SUMMARY_AI_TRACE_MARKER)) {
  fail(`Summary AI trace marker must be absent in disabled assets (${SUMMARY_AI_TRACE_MARKER})`);
} else if (blob.includes(INTERNAL_AI_DIAGNOSTICS_298)) {
  fail(`internal diagnostics revision must be absent in disabled assets (${INTERNAL_AI_DIAGNOSTICS_298})`);
} else {
  log(`OK disabled assets: marker absent (button=${hasButton}, channel=${hasChannel}, status=${hasStatus}); Summary runtime revisions still present`);
}
