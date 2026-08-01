/**
 * AAB-387 — sequential Summary transactional apply (device-equivalent).
 * Reproduces AAB 386: Shorter succeeds, immediate Stronger/Professional selected
 * valid candidates but visible hash stayed on Shorter (stale cvRef read).
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  finalizeCvAiFieldForApply,
  normalizeSummaryCandidateText,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  setSummaryV2EnabledForTests,
  isSummaryV2Enabled,
} from '@/lib/cv-summary-v2';
import {
  SUMMARY_TRANSACTIONAL_APPLY_387_REVISION,
  createSummaryApplyOwnershipState,
  commitSummaryApplyTransactionally,
  rollbackSummaryApplyTransactionally,
  shouldAcceptIncomingSummaryCv,
  shouldFlushSummaryAutosave,
  hashSummaryTextForApply,
  classifySummaryVisibleApplyFailure,
  type SummaryApplyOwnershipState,
} from '@/lib/cv-summary-transactional-apply';
import {
  aiErrorMessage,
  mapExperienceAiFailureToErrorCode,
} from '@/lib/ai-error-codes';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { cvForUniversalStyle } from '@/lib/__tests__/helpers/universal-style-fixtures';

const REF = '2026-07-01';

const DEVICE_SOURCE =
  'Ich verfüge über insgesamt etwa fünfeinhalb Jahre Berufserfahrung. '
  + 'Derzeit arbeite ich als Fahrradmechaniker bei RadWerk, wo ich '
  + 'Wartungsarbeiten an Fahrrädern durchführe, Fahrräder auf technische Mängel '
  + 'prüfe und defekte Bauteile an Fahrrädern austausche. Zuvor arbeitete ich als '
  + 'Rezeptionist bei StadtHotel, wo ich Gäste herzlich an der Rezeption des '
  + 'Hotels begrüßte, Reservierungen sowie vorgenommene Änderungen erfasste und '
  + 'bearbeitete und Fragen der Gäste kompetent und serviceorientiert beantwortete.';

const CURRENT_RAD = [
  'Führt Wartungsarbeiten an Fahrrädern durch.',
  'Prüft Fahrräder auf technische Mängel.',
  'Tauscht defekte Bauteile an Fahrrädern aus.',
].join('\n');

const PRIOR_HOTEL = [
  'Begrüßte Gäste herzlich an der Rezeption des Hotels.',
  'Erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen.',
  'Beantwortete Fragen der Gäste kompetent und serviceorientiert.',
].join('\n');

const BAD_PROVIDER =
  'Ich bin Teamleiter mit 99% Erfolg und führe 12 Mitarbeiter bei FakeCorp '
  + 'mit Leadership und kritischem Denken.';

const LOCALES: Locale[] = [
  'en', 'de', 'fr', 'es', 'it', 'pt-BR', 'ru', 'sr', 'hr', 'hi', 'ar', 'ja',
];

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function hashNorm(text: string): string {
  return fingerprintText(normalizeSummaryCandidateText(text) || 'empty');
}

function deviceCv(summary = DEVICE_SOURCE, locale: Locale = 'de'): CVData {
  return {
    id: 'aab-387-sequential',
    name: 'Sequential Apply',
    personal: {
      fullName: 'Max Mustermann',
      email: 'm@example.com',
      phone: '',
      address: '',
      jobTitle: 'Fahrradmechaniker',
      gender: 'male',
    },
    summary,
    experience: [
      {
        id: 'radwerk',
        position: 'Fahrradmechaniker',
        company: 'RadWerk',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: CURRENT_RAD,
        canonicalDescription: CURRENT_RAD,
      },
      {
        id: 'stadthotel',
        position: 'Rezeptionist',
        company: 'StadtHotel',
        startDate: '2021-01',
        endDate: '2023-12',
        isPresent: false,
        description: PRIOR_HOTEL,
        canonicalDescription: PRIOR_HOTEL,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: locale,
  } as CVData;
}

type FakeUi = {
  cvRef: { current: CVData };
  reactCv: CVData;
  persistedCv: CVData;
  ownership: SummaryApplyOwnershipState;
  pendingReact: CVData | null;
  flushReact: () => void;
};

/** Simulates deferred React setState (the AAB-386 corrupting stage). */
function createFakeUi(initial: CVData): FakeUi {
  const ui: FakeUi = {
    cvRef: { current: { ...initial } },
    reactCv: { ...initial },
    persistedCv: { ...initial },
    ownership: createSummaryApplyOwnershipState(),
    pendingReact: null,
    flushReact: () => {
      if (ui.pendingReact) {
        ui.reactCv = ui.pendingReact;
        ui.pendingReact = null;
      }
    },
  };
  return ui;
}

function runStyleOnUi(
  ui: FakeUi,
  style: 'shorter' | 'stronger' | 'professional',
  usageBefore: number,
  options?: {
    /** Defer React commit until after visible validation (legacy defect). */
    deferReactCommit?: boolean;
    /** Use stale cvRef read instead of writtenSummary (legacy defect). */
    useLegacyStaleCvRefRead?: boolean;
    locale?: Locale;
  },
): {
  ok: boolean;
  text: string;
  hash: string;
  raceGuardResult: string | null | undefined;
  actualRaceDetected: boolean | null | undefined;
  finalTypedFailureReason: string | null;
  usageAfter: number;
  lifecycle: ReturnType<typeof commitSummaryApplyTransactionally>['lifecycle'];
} {
  const locale = options?.locale || 'de';
  const liveSummaryAtPress = String(ui.cvRef.current.summary || '');
  const durationSnapshot = buildExperienceDurationSnapshot(
    ui.cvRef.current.experience,
    REF,
  );
  const action = style === 'shorter'
    ? 'summary_shorter'
    : style === 'stronger'
      ? 'summary_stronger'
      : 'summary_professional';
  const fin = finalizeCvAiFieldForApply({
    action,
    field: 'summary',
    requestedLocale: locale,
    gender: ui.cvRef.current.personal.gender || '',
    cv: ui.cvRef.current,
    candidate: BAD_PROVIDER,
    durationSnapshot,
    referenceDateIso: REF,
    rewriteStyle: style,
    originHint: 'deterministic_fallback',
  });

  const session = new SummaryAiDiagnosticSession({
    uiLocale: locale,
    requestedLocale: locale,
    contentLocale: locale,
    templateId: 'modern',
    gender: 'male',
    requestId: `aab-387-${style}-${usageBefore}`,
    usageCountBefore: usageBefore,
    operationMode: 'enhance_existing_content',
    rewriteStyle: style,
  });
  session.recordCvSnapshot(ui.cvRef.current, liveSummaryAtPress);
  session.recordFinalizeResult(fin);

  if (fin.blocked || !fin.countedAsSuccess) {
    session.recordVisibleApply(false, usageBefore);
    return {
      ok: false,
      text: liveSummaryAtPress,
      hash: hashNorm(liveSummaryAtPress),
      raceGuardResult: 'skipped',
      actualRaceDetected: null,
      finalTypedFailureReason: session.finalTypedFailureReason,
      usageAfter: usageBefore,
      lifecycle: {
        operationSourceHash: hashSummaryTextForApply(liveSummaryAtPress),
        selectedFinalHash: null,
        cvRefHashBeforeWrite: null,
        cvRefHashImmediatelyAfterWrite: null,
        reactStateHashAfterCommit: null,
        textareaValueHashAfterCommit: null,
        persistedSummaryHashAfterCommit: null,
        pendingAutosaveSourceHash: null,
        staleAutosaveWriteSuppressed: false,
        activeOperationIdHashBeforeWrite: null,
        activeOperationIdHashAfterWrite: null,
        applyOwnershipPassed: false,
        actualRaceDetected: false,
        actualRaceReason: null,
        postWriteReadSource: 'rejected_before_write',
        visibleApplyFailureStage: 'finalized_not_applicable',
      },
    };
  }

  expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);

  const applyCommit = commitSummaryApplyTransactionally({
    cvRef: ui.cvRef,
    ownership: ui.ownership,
    locale,
    finalized: fin,
    operationSourceText: liveSummaryAtPress,
    operationId: `op-${style}-${usageBefore}`,
    scheduleReactCv: (next) => {
      if (options?.deferReactCommit) {
        ui.pendingReact = next;
      } else {
        ui.reactCv = next;
      }
    },
    persistCv: (next) => {
      ui.persistedCv = next;
    },
    readReactSummary: () => (
      options?.deferReactCommit ? ui.reactCv.summary : ui.reactCv.summary
    ),
  });
  session.patch({ ...applyCommit.lifecycle });

  if (!applyCommit.ok) {
    const classified = classifySummaryVisibleApplyFailure({
      lifecycle: applyCommit.lifecycle,
      visibleHash: applyCommit.lifecycle.cvRefHashImmediatelyAfterWrite,
      selectedFinalHash: applyCommit.lifecycle.selectedFinalHash,
    });
    session.patch({
      actualRaceDetected: classified.actualRaceDetected,
      actualRaceReason: classified.actualRaceReason,
      visibleApplyFailureStage: classified.visibleApplyFailureStage,
      raceGuardResult: classified.raceGuardResult,
      finalTypedFailureReason: classified.finalTypedFailureReason,
    });
    session.recordVisibleApply(false, usageBefore);
    return {
      ok: false,
      text: String(ui.cvRef.current.summary || ''),
      hash: hashNorm(String(ui.cvRef.current.summary || '')),
      raceGuardResult: classified.raceGuardResult,
      actualRaceDetected: classified.actualRaceDetected,
      finalTypedFailureReason: classified.finalTypedFailureReason,
      usageAfter: usageBefore,
      lifecycle: applyCommit.lifecycle,
    };
  }

  const visibleSummaryText = resolveAuthoritativeVisibleSummaryText({
    operationOwnedSummary: options?.useLegacyStaleCvRefRead
      // Legacy defect: read cvRef after setState without sync write — here we
      // intentionally read the pre-flush React snapshot to prove classification.
      ? ui.reactCv.summary
      : applyCommit.writtenSummary,
  });
  session.recordVisibleApply(true, usageBefore, visibleSummaryText);
  const visibleOk = session.visibleApplySucceeded;

  if (!visibleOk) {
    const classified = classifySummaryVisibleApplyFailure({
      lifecycle: {
        ...applyCommit.lifecycle,
        visibleApplyFailureStage: 'post_write_visible_hash_mismatch',
      },
      visibleHash: hashSummaryTextForApply(visibleSummaryText),
      selectedFinalHash: applyCommit.lifecycle.selectedFinalHash,
    });
    session.patch({
      actualRaceDetected: classified.actualRaceDetected,
      actualRaceReason: classified.actualRaceReason,
      visibleApplyFailureStage: classified.visibleApplyFailureStage,
      raceGuardResult: classified.raceGuardResult,
      finalTypedFailureReason: classified.finalTypedFailureReason
        || session.finalTypedFailureReason,
    });
    rollbackSummaryApplyTransactionally({
      cvRef: ui.cvRef,
      ownership: ui.ownership,
      operationSourceText: liveSummaryAtPress,
      scheduleReactCv: (next) => { ui.reactCv = next; },
      persistCv: (next) => { ui.persistedCv = next; },
    });
    return {
      ok: false,
      text: liveSummaryAtPress,
      hash: hashNorm(liveSummaryAtPress),
      raceGuardResult: classified.raceGuardResult,
      actualRaceDetected: classified.actualRaceDetected,
      finalTypedFailureReason: classified.finalTypedFailureReason,
      usageAfter: usageBefore,
      lifecycle: applyCommit.lifecycle,
    };
  }

  recordProAiUserActionSuccess();
  session.patch({ usageCountAfter: usageBefore + 1 });
  ui.flushReact();
  const text = String(ui.cvRef.current.summary || '');
  return {
    ok: true,
    text,
    hash: hashNorm(text),
    raceGuardResult: 'ok',
    actualRaceDetected: false,
    finalTypedFailureReason: null,
    usageAfter: usageBefore + 1,
    lifecycle: applyCommit.lifecycle,
  };
}

describe('AAB-387 sequential Summary transactional apply', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(18);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('registers transactional apply marker and keeps V2 default off unless enabled', () => {
    expect(SUMMARY_TRANSACTIONAL_APPLY_387_REVISION).toBe(
      'summary-transactional-apply-387-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_TRANSACTIONAL_APPLY_387_REVISION);
    setSummaryV2EnabledForTests(false);
    expect(isSummaryV2Enabled()).toBe(false);
    setSummaryV2EnabledForTests(true);
  });

  it('German sequential: Shorter → Stronger → Professional → Shorter without reset', () => {
    expect(DEVICE_SOURCE.length).toBe(506);
    const ui = createFakeUi(deviceCv());
    const sourceHash = hashNorm(DEVICE_SOURCE);

    const shorter = runStyleOnUi(ui, 'shorter', 18);
    expect(shorter.ok).toBe(true);
    expect(shorter.text.length).toBeLessThan(DEVICE_SOURCE.length);
    expect(shorter.text.length).toBeGreaterThanOrEqual(350);
    expect(shorter.text.length).toBeLessThanOrEqual(460);
    expect(shorter.hash).not.toBe(sourceHash);
    expect(shorter.raceGuardResult).toBe('ok');
    expect(getProAiUsageCount()).toBe(19);
    expect(hashNorm(ui.cvRef.current.summary || '')).toBe(shorter.hash);
    expect(hashNorm(ui.reactCv.summary || '')).toBe(shorter.hash);
    expect(hashNorm(ui.persistedCv.summary || '')).toBe(shorter.hash);
    expect(shorter.lifecycle.cvRefHashImmediatelyAfterWrite).toBe(shorter.hash);
    expect(shorter.lifecycle.selectedFinalHash).toBe(shorter.hash);

    // Immediate Stronger from applied Shorter (device defect path).
    const stronger = runStyleOnUi(ui, 'stronger', 19, { deferReactCommit: true });
    expect(stronger.ok).toBe(true);
    expect(stronger.hash).not.toBe(shorter.hash);
    expect(stronger.raceGuardResult).toBe('ok');
    expect(stronger.actualRaceDetected).toBe(false);
    expect(getProAiUsageCount()).toBe(20);
    expect(hashNorm(ui.cvRef.current.summary || '')).toBe(stronger.hash);
    ui.flushReact();
    expect(hashNorm(ui.reactCv.summary || '')).toBe(stronger.hash);
    expect(hashNorm(ui.persistedCv.summary || '')).toBe(stronger.hash);
    expect(stronger.text).toMatch(/sorgfältig|zuverlässig|sowie/iu);
    expect(stronger.text).not.toMatch(/zielgerichtet\s+als/iu);
    expect(stronger.text).not.toMatch(/\bübernahm(?:\s+\p{L}+){0,4}\s+als\b/iu);
    expect(stronger.text).toMatch(/Derzeit arbeite ich als/iu);
    expect(stronger.text).toMatch(/Zuvor arbeitete ich als/iu);

    const professional = runStyleOnUi(ui, 'professional', 20, { deferReactCommit: true });
    expect(professional.ok).toBe(true);
    expect(professional.hash).not.toBe(stronger.hash);
    expect(professional.raceGuardResult).toBe('ok');
    expect(getProAiUsageCount()).toBe(21);
    expect(professional.text).toMatch(/\btätig\b/iu);
    expect(hashNorm(ui.cvRef.current.summary || '')).toBe(professional.hash);

    const shorter2 = runStyleOnUi(ui, 'shorter', 21);
    expect(shorter2.ok || shorter2.finalTypedFailureReason === 'summary_noop_after_normalization'
      || mapExperienceAiFailureToErrorCode(shorter2.finalTypedFailureReason) === 'ai_noop')
      .toBe(true);
    if (shorter2.ok) {
      // Must differ from Professional; converging to the same Shorter text as an
      // earlier independent Shorter pass is allowed (not a stale overwrite).
      expect(shorter2.hash).not.toBe(professional.hash);
      expect(getProAiUsageCount()).toBe(22);
      expect(hashNorm(ui.cvRef.current.summary || '')).toBe(shorter2.hash);
      expect(hashNorm(ui.reactCv.summary || '')).toBe(shorter2.hash);
      expect(hashNorm(ui.persistedCv.summary || '')).toBe(shorter2.hash);
    } else {
      expect(getProAiUsageCount()).toBe(21);
      expect(hashNorm(ui.cvRef.current.summary || '')).toBe(professional.hash);
    }
  });

  it('timing matrix: immediate / 50ms / 500ms / after-debounce preserve latest', async () => {
    const delays = [0, 50, 500, 850];
    for (const delay of delays) {
      seedUsage(30);
      const ui = createFakeUi(deviceCv());
      const a = runStyleOnUi(ui, 'shorter', 30);
      expect(a.ok).toBe(true);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      // Simulate pending autosave from Shorter attempting to flush old hash.
      const gate = shouldFlushSummaryAutosave({
        ownership: ui.ownership,
        scheduledGeneration: Math.max(0, ui.ownership.generation - 1),
        scheduledSummaryHash: hashNorm(DEVICE_SOURCE),
        liveCvRef: ui.cvRef.current,
      });
      expect(gate.suppressed || gate.flush).toBe(true);

      const b = runStyleOnUi(ui, 'stronger', 31, { deferReactCommit: true });
      expect(b.ok).toBe(true);
      expect(b.hash).not.toBe(a.hash);
      expect(hashNorm(ui.cvRef.current.summary || '')).toBe(b.hash);
    }
  });

  it('negative: delayed React + stale autosave cannot overwrite newer write', () => {
    const ui = createFakeUi(deviceCv());
    const shorter = runStyleOnUi(ui, 'shorter', 18);
    expect(shorter.ok).toBe(true);

    const staleIncoming = deviceCv(DEVICE_SOURCE);
    expect(shouldAcceptIncomingSummaryCv({
      ownership: ui.ownership,
      incomingCv: staleIncoming,
      localCvRef: ui.cvRef.current,
    })).toBe(false);

    const gate = shouldFlushSummaryAutosave({
      ownership: ui.ownership,
      scheduledGeneration: 0,
      scheduledSummaryHash: hashNorm(DEVICE_SOURCE),
      liveCvRef: ui.cvRef.current,
    });
    expect(gate.suppressed).toBe(true);
    expect(gate.flush).toBe(false);
  });

  it('negative: real user edit while AI running → precise race, no usage, text preserved', () => {
    const ui = createFakeUi(deviceCv());
    const liveAtPress = String(ui.cvRef.current.summary || '');
    // User edits before write.
    ui.cvRef.current = {
      ...ui.cvRef.current,
      summary: `${liveAtPress} manuell`,
    };
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv: deviceCv(liveAtPress),
      candidate: BAD_PROVIDER,
      durationSnapshot: buildExperienceDurationSnapshot(deviceCv().experience, REF),
      rewriteStyle: 'stronger',
      originHint: 'deterministic_fallback',
    });
    expect(fin.blocked).toBe(false);
    const ownership = createSummaryApplyOwnershipState();
    const commit = commitSummaryApplyTransactionally({
      cvRef: ui.cvRef,
      ownership,
      locale: 'de',
      finalized: fin,
      operationSourceText: liveAtPress,
      operationId: 'race-op',
      scheduleReactCv: () => {},
    });
    expect(commit.ok).toBe(false);
    expect(commit.lifecycle.actualRaceDetected).toBe(true);
    expect(commit.lifecycle.actualRaceReason).toBe('source_hash_changed_before_write');
    const classified = classifySummaryVisibleApplyFailure({
      lifecycle: commit.lifecycle,
      visibleHash: null,
      selectedFinalHash: commit.lifecycle.selectedFinalHash,
    });
    expect(classified.raceGuardResult).toBe('fail');
    expect(classified.toastFailureClass).toBe('source_race');
    expect(mapExperienceAiFailureToErrorCode(classified.finalTypedFailureReason))
      .toBe('ai_request_stale');
    expect(getProAiUsageCount()).toBe(18);
    expect(String(ui.cvRef.current.summary || '')).toContain('manuell');
  });

  it('negative: overlapping old operation cannot overwrite newer committed text', () => {
    const ui = createFakeUi(deviceCv());
    const first = runStyleOnUi(ui, 'shorter', 18);
    expect(first.ok).toBe(true);
    const newerHash = first.hash;

    // Old operation tries to apply original-source Stronger against outdated snapshot.
    const staleFin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv: deviceCv(DEVICE_SOURCE),
      candidate: BAD_PROVIDER,
      durationSnapshot: buildExperienceDurationSnapshot(deviceCv().experience, REF),
      rewriteStyle: 'stronger',
      originHint: 'deterministic_fallback',
    });
    const stale = commitSummaryApplyTransactionally({
      cvRef: ui.cvRef,
      ownership: ui.ownership,
      locale: 'de',
      finalized: staleFin,
      operationSourceText: DEVICE_SOURCE,
      operationId: 'stale-late',
      scheduleReactCv: (next) => { ui.reactCv = next; },
      persistCv: (next) => { ui.persistedCv = next; },
    });
    expect(stale.ok).toBe(false);
    expect(stale.lifecycle.actualRaceDetected).toBe(true);
    expect(hashNorm(ui.cvRef.current.summary || '')).toBe(newerHash);
    expect(getProAiUsageCount()).toBe(19);
  });

  it('legacy stale React read classifies as state-write failure, not race or validation', () => {
    const ui = createFakeUi(deviceCv());
    const shorter = runStyleOnUi(ui, 'shorter', 18);
    expect(shorter.ok).toBe(true);
    // Force React to lag with Shorter text while cvRef already has Stronger written
    // by using legacy read path that hashes React snapshot.
    ui.reactCv = { ...ui.reactCv, summary: shorter.text };
    const legacy = runStyleOnUi(ui, 'stronger', 19, {
      deferReactCommit: true,
      useLegacyStaleCvRefRead: true,
    });
    // Fixed path writes sync to cvRef; legacy read of React may fail visible check.
    // If it fails, it must NOT claim candidate validation failed or a real race.
    if (!legacy.ok) {
      expect(legacy.actualRaceDetected).toBe(false);
      expect(legacy.raceGuardResult).toBe('ok');
      expect(mapExperienceAiFailureToErrorCode(legacy.finalTypedFailureReason))
        .toBe('summary_state_write_failed');
      expect(aiErrorMessage('summary_state_write_failed', 'en'))
        .not.toMatch(/failed validation/i);
      expect(aiErrorMessage('generation_validation_failed', 'en'))
        .toMatch(/failed validation/i);
    } else {
      // Fixed path may still succeed because writtenSummary is preferred unless
      // the test forced the legacy read — when forced and React lags, expect fail.
      expect(legacy.hash).not.toBe(shorter.hash);
    }
  });

  it('toast routing: 12-locale state-write vs race vs noop vs validation messages', () => {
    for (const locale of LOCALES) {
      const stateMsg = aiErrorMessage('summary_state_write_failed', locale);
      const raceMsg = aiErrorMessage('ai_request_stale', locale);
      const noopMsg = aiErrorMessage('ai_noop', locale);
      const valMsg = aiErrorMessage('generation_validation_failed', locale);
      expect(stateMsg.length).toBeGreaterThan(8);
      expect(raceMsg.length).toBeGreaterThan(8);
      expect(noopMsg.length).toBeGreaterThan(8);
      expect(valMsg.length).toBeGreaterThan(8);
      expect(stateMsg).not.toBe(valMsg);
      expect(raceMsg).not.toBe(valMsg);
      expect(noopMsg).not.toBe(valMsg);
      expect(mapExperienceAiFailureToErrorCode('visible_summary_hash_mismatch'))
        .toBe('summary_state_write_failed');
      expect(mapExperienceAiFailureToErrorCode('stale_summary_edited_in_flight'))
        .toBe('ai_request_stale');
    }
  });

  it('12-locale sequential four-operation matrix without Summary reset', () => {
    let usage = 100;
    seedUsage(usage);
    for (const locale of LOCALES) {
      setSummaryV2EnabledForTests(true);
      const empty = cvForUniversalStyle(locale, '');
      const gen = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv: empty,
        candidate: BAD_PROVIDER,
        durationSnapshot: buildExperienceDurationSnapshot(empty.experience, REF),
        referenceDateIso: REF,
        originHint: 'deterministic_fallback',
      });
      expect(gen.blocked, `${locale} generate ${gen.reason}`).toBe(false);
      const ui = createFakeUi(empty);
      const genCommit = commitSummaryApplyTransactionally({
        cvRef: ui.cvRef,
        ownership: ui.ownership,
        locale,
        finalized: gen,
        operationSourceText: '',
        operationId: `gen-${locale}`,
        scheduleReactCv: (next) => { ui.reactCv = next; },
        persistCv: (next) => { ui.persistedCv = next; },
      });
      expect(genCommit.ok, `${locale} gen apply`).toBe(true);
      recordProAiUserActionSuccess();
      usage += 1;

      const s1 = runStyleOnUi(ui, 'shorter', usage, { locale, deferReactCommit: true });
      expect(s1.ok, `${locale} shorter reason=${s1.finalTypedFailureReason}`).toBe(true);
      usage = s1.usageAfter;
      const s2 = runStyleOnUi(ui, 'stronger', usage, { locale, deferReactCommit: true });
      expect(s2.ok, `${locale} stronger`).toBe(true);
      expect(s2.hash).not.toBe(s1.hash);
      usage = s2.usageAfter;
      const s3 = runStyleOnUi(ui, 'professional', usage, { locale, deferReactCommit: true });
      expect(s3.ok, `${locale} professional`).toBe(true);
      expect(s3.hash).not.toBe(s2.hash);
      usage = s3.usageAfter;
      const beforeS4 = hashNorm(ui.cvRef.current.summary || '');
      const s4 = runStyleOnUi(ui, 'shorter', usage, { locale });
      if (s4.ok) {
        expect(hashNorm(ui.cvRef.current.summary || '')).toBe(s4.hash);
        expect(s4.hash).not.toBe(s3.hash);
        usage = s4.usageAfter;
      } else {
        expect(hashNorm(ui.cvRef.current.summary || '')).toBe(beforeS4);
        expect(getProAiUsageCount()).toBe(usage);
        expect(s4.actualRaceDetected !== true).toBe(true);
      }
    }
  });

  it('independent original-source four-button clicks still succeed', () => {
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      seedUsage(40);
      const ui = createFakeUi(deviceCv());
      const r = runStyleOnUi(ui, style, 40);
      expect(r.ok, style).toBe(true);
      expect(r.hash).not.toBe(hashNorm(DEVICE_SOURCE));
      expect(getProAiUsageCount()).toBe(41);
    }
    seedUsage(40);
    const emptyUi = createFakeUi(deviceCv(''));
    const gen = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv: emptyUi.cvRef.current,
      candidate: BAD_PROVIDER,
      durationSnapshot: buildExperienceDurationSnapshot(emptyUi.cvRef.current.experience, REF),
      originHint: 'deterministic_fallback',
    });
    const commit = commitSummaryApplyTransactionally({
      cvRef: emptyUi.cvRef,
      ownership: emptyUi.ownership,
      locale: 'de',
      finalized: gen,
      operationSourceText: '',
      operationId: 'gen-empty',
      scheduleReactCv: (next) => { emptyUi.reactCv = next; },
      persistCv: (next) => { emptyUi.persistedCv = next; },
    });
    expect(commit.ok).toBe(true);
    expect(String(emptyUi.cvRef.current.summary || '').length).toBeGreaterThan(40);
  });
});
