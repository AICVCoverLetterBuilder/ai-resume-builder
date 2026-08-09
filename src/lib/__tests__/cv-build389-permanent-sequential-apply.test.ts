/**
 * Permanent AAB-389 — sequential device-equivalent Summary apply.
 * Generate → Shorter → Stronger → Professional → Shorter → Stronger
 * with immediate / 50 / 500 / 850 ms timing and race controls.
 *
 * @vitest-environment jsdom
 */
import { resolveCvExportSourceAuthority } from '@/lib/cv-export-source-authority';
import { syncCvRefFromReactState } from '@/lib/cv-summary-cvref-react-sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
} from '@/lib/cv-summary-ai-diagnostics';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2';
import {
  createSummaryApplyOwnershipState,
  commitSummaryApplyTransactionally,
  shouldAcceptIncomingSummaryCv,
  classifySummaryVisibleApplyFailure,
  type SummaryApplyOwnershipState,
} from '@/lib/cv-summary-transactional-apply';
import {
  getProAiUsageCount,
  recordProAiUserActionSuccess,
} from '@/lib/ai-usage-policy';
import {
  AAB389_BAD_PROVIDER,
  AAB389_REF,
  aab389Cv,
  aab389DeterministicSource,
  aab389SeedUsage,
  aab389Hash,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

const SEQ_LOCALES: Locale[] = ['de', 'sr', 'hr', 'ar', 'hi', 'ja'];
const DELAYS_MS = [0, 50, 500, 850] as const;
const SEQ_STYLES = [
  'generate_existing',
  'shorter',
  'stronger',
  'professional',
  'shorter',
  'stronger',
] as const;

type FakeUi = {
  cvRef: { current: CVData };
  reactCv: CVData;
  persistedCv: CVData;
  ownership: SummaryApplyOwnershipState;
  pendingReact: CVData | null;
  flushReact: () => void;
};

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

function delay(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));
}

async function runStep(
  ui: FakeUi,
  locale: Locale,
  style: (typeof SEQ_STYLES)[number],
  usageBefore: number,
  waitMs: number,
): Promise<{ ok: boolean; text: string; hash: string; usageAfter: number }> {
  await delay(waitMs);
  const liveSummary = String(ui.cvRef.current.summary || '');
  const duration = buildExperienceDurationSnapshot(ui.cvRef.current.experience, AAB389_REF);
  const action = style === 'generate_existing'
    ? 'summary_generate'
    : `summary_${style}`;
  const rewriteStyle = style === 'generate_existing'
    ? undefined
    : (style as 'shorter' | 'stronger' | 'professional');
  const fin = finalizeCvAiFieldForApply({
    action,
    field: 'summary',
    requestedLocale: locale,
    gender: 'male',
    cv: ui.cvRef.current,
    candidate: AAB389_BAD_PROVIDER,
    referenceDateIso: AAB389_REF,
    durationSnapshot: duration,
    ...(rewriteStyle ? { rewriteStyle } : {}),
  });

  const session = new SummaryAiDiagnosticSession({
    uiLocale: locale,
    requestedLocale: locale,
    contentLocale: locale,
    templateId: 'modern',
    gender: 'male',
    requestId: `aab389-seq-${locale}-${style}-${usageBefore}`,
    usageCountBefore: usageBefore,
    operationMode: 'enhance_existing_content',
  });
  session.recordFinalizeResult(fin);

  if (fin.blocked || !fin.countedAsSuccess) {
    session.recordVisibleApply(false, usageBefore);
    return {
      ok: false,
      text: liveSummary,
      hash: aab389Hash(liveSummary),
      usageAfter: usageBefore,
    };
  }

  const applyCommit = commitSummaryApplyTransactionally({
    cvRef: ui.cvRef,
    ownership: ui.ownership,
    locale,
    finalized: fin,
    operationSourceText: liveSummary,
    operationId: `op-${locale}-${style}-${usageBefore}`,
    scheduleReactCv: (next) => {
      ui.pendingReact = next;
    },
    persistCv: (next) => {
      ui.persistedCv = next;
    },
    readReactSummary: () => ui.reactCv.summary,
  });
  session.patch({ ...applyCommit.lifecycle });

  if (!applyCommit.ok) {
    const classified = classifySummaryVisibleApplyFailure({
      lifecycle: applyCommit.lifecycle,
      visibleHash: applyCommit.lifecycle.cvRefHashImmediatelyAfterWrite,
      selectedFinalHash: applyCommit.lifecycle.selectedFinalHash,
    });
    session.recordVisibleApply(false, usageBefore);
    return {
      ok: false,
      text: String(ui.cvRef.current.summary || ''),
      hash: aab389Hash(String(ui.cvRef.current.summary || '')),
      usageAfter: usageBefore,
    };
  }

  ui.flushReact();
  const visible = resolveAuthoritativeVisibleSummaryText({
    operationOwnedSummary: applyCommit.writtenSummary,
    staleReactSummary: '',
  });
  session.recordVisibleApply(true, usageBefore, visible);
  expect(session.draft.raceGuardResult).toBe('ok');
  expect(aab389Hash(visible)).toBe(aab389Hash(fin.text || ''));
  expect(aab389Hash(ui.cvRef.current.summary || '')).toBe(aab389Hash(fin.text || ''));
  expect(aab389Hash(ui.reactCv.summary || '')).toBe(aab389Hash(fin.text || ''));
  expect(aab389Hash(ui.persistedCv.summary || '')).toBe(aab389Hash(fin.text || ''));
  recordProAiUserActionSuccess();
  return {
    ok: true,
    text: fin.text || '',
    hash: aab389Hash(fin.text || ''),
    usageAfter: getProAiUsageCount(),
  };
}

describe('AAB-389 permanent sequential apply', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('6 locales × 4 timings: sequential rewrite chain keeps ownership + hashes', async () => {
    let usage = 100;
    for (const locale of SEQ_LOCALES) {
      for (const waitMs of DELAYS_MS) {
        const source = aab389DeterministicSource(locale, 'male');
        const initial = aab389Cv({ locale, gender: 'male', summary: source });
        const ui = createFakeUi(initial);
        aab389SeedUsage(usage);
        let lastHash = aab389Hash(source);
        for (const style of SEQ_STYLES) {
          const step = await runStep(ui, locale, style, usage, waitMs);
          expect(step.ok, `${locale}/${waitMs}ms/${style}`).toBe(true);
          expect(step.hash, `${locale}/${waitMs}ms/${style}`).not.toBe(lastHash);
          lastHash = step.hash;
          usage = step.usageAfter;
        }
      }
    }
  }, 180_000);

  it('real user-edit race rejects stale incoming CV; write failure is typed', () => {
    const locale: Locale = 'de';
    const source = aab389DeterministicSource(locale, 'male');
    const ui = createFakeUi(aab389Cv({ locale, gender: 'male', summary: source }));
    // Establish authoritative ownership after a successful write.
    ui.ownership.authoritativeSummaryHash = aab389Hash(source);
    ui.ownership.generation = 1;
    const incoming = {
      ...ui.cvRef.current,
      summary: `${source} USER EDIT`,
    };
    const accept = shouldAcceptIncomingSummaryCv({
      ownership: ui.ownership,
      incomingCv: incoming,
      localCvRef: ui.cvRef.current,
    });
    expect(accept).toBe(false);

    // Source hash changed before write → race.
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: locale,
      gender: 'male',
      cv: ui.cvRef.current,
      candidate: AAB389_BAD_PROVIDER,
      referenceDateIso: AAB389_REF,
      durationSnapshot: buildExperienceDurationSnapshot(ui.cvRef.current.experience, AAB389_REF),
      rewriteStyle: 'stronger',
    });
    expect(fin.blocked).toBe(false);
    ui.cvRef.current = { ...ui.cvRef.current, summary: `${source} RACE` };
    const raced = commitSummaryApplyTransactionally({
      cvRef: ui.cvRef,
      ownership: ui.ownership,
      locale,
      finalized: fin,
      operationSourceText: source,
      operationId: 'race-op',
      scheduleReactCv: () => {},
    });
    expect(raced.ok).toBe(false);
    expect(raced.lifecycle.actualRaceDetected).toBe(true);
    expect(raced.lifecycle.actualRaceReason).toBe('source_hash_changed_before_write');
    const classified = classifySummaryVisibleApplyFailure({
      lifecycle: raced.lifecycle,
      visibleHash: raced.lifecycle.cvRefHashImmediatelyAfterWrite,
      selectedFinalHash: raced.lifecycle.selectedFinalHash,
    });
    expect(classified.actualRaceDetected).toBe(true);
  });
});


describe('AAB-411 executable pre-phone export authority regression', () => {
  const staleAab410Summary =
    'professional con alrededor de tres a?os y medio de experiencia.';

  const authoritativeShorterSummary =
    'Tengo unos tres a?os y medio de experiencia. Actualmente soy Coordinador de servicio de bicicletas el?ctricas y recepci?n de clientes en RadWerk, donde coordino las citas de mantenimiento de bicicletas el?ctricas y reviso las bicicletas entrantes y documento los problemas t?cnicos y explico a los clientes los pasos de reparaci?n necesarios. Antes fui Empleado de recepci?n de hu?spedes y gesti?n de reservas en StadtHotel, donde recib? a los hu?spedes en la recepci?n y gestion? las reservas y los cambios necesarios y atend? consultas por tel?fono y correo electr?nico.';

  it('reproduces exact AAB-410 stale 63 -> authoritative 572 boundary', () => {
    expect(
      staleAab410Summary,
    ).toHaveLength(63);

    expect(
      authoritativeShorterSummary,
    ).toHaveLength(572);

    const initial = aab389Cv({
      locale: 'de',
      gender: 'male',
      summary:
        authoritativeShorterSummary,
    });

    const ui = createFakeUi(initial);

    const authoritativeHash =
      aab389Hash(
        authoritativeShorterSummary,
      );

    ui.ownership.authoritativeSummaryHash =
      authoritativeHash;

    ui.ownership.generation = 1;

    const staleReactCv: CVData = {
      ...ui.reactCv,
      summary: staleAab410Summary,
    };

    const sync =
      syncCvRefFromReactState({
        cvRef: ui.cvRef,
        ownership: ui.ownership,
        nextCv: staleReactCv,
        currentSummaryHash:
          aab389Hash(
            String(
              ui.cvRef.current.summary || '',
            ),
          ),
        nextSummaryHash:
          aab389Hash(
            String(
              staleReactCv.summary || '',
            ),
          ),
      });

    expect(sync.accepted).toBe(false);

    expect(sync.reason).toBe(
      'authoritative_summary_hash_mismatch',
    );

    expect(
      ui.cvRef.current.summary,
    ).toBe(
      authoritativeShorterSummary,
    );

    expect(
      aab389Hash(
        String(
          ui.cvRef.current.summary || '',
        ),
      ),
    ).toBe(authoritativeHash);

    const pdf =
      resolveCvExportSourceAuthority(
        ui.cvRef.current,
        'modern-minimal',
      );

    const docx =
      resolveCvExportSourceAuthority(
        ui.cvRef.current,
        'modern-minimal',
      );

    expect(pdf.summary).toBe(
      authoritativeShorterSummary,
    );

    expect(docx.summary).toBe(
      authoritativeShorterSummary,
    );

    expect(pdf.summary).not.toBe(
      staleAab410Summary,
    );

    expect(docx.summary).not.toBe(
      staleAab410Summary,
    );
  });

  it('executes real Generate -> Shorter commit and rejects stale React before export', async () => {
    const locale: Locale = 'de';

    const source =
      aab389DeterministicSource(
        locale,
        'male',
      );

    const initial = aab389Cv({
      locale,
      gender: 'male',
      summary: source,
    });

    const ui = createFakeUi(initial);

    aab389SeedUsage(0);

    /*
     * First establish a normal successful
     * generated Summary through the existing
     * permanent runtime harness.
     */
    const generated = await runStep(
      ui,
      locale,
      'generate_existing',
      0,
      0,
    );

    expect(generated.ok).toBe(true);

    const beforeShorter =
      String(
        ui.cvRef.current.summary || '',
      );

    const beforeShorterHash =
      aab389Hash(beforeShorter);

    /*
     * Execute the SAME finalizer used by runStep,
     * but stop before React flush.
     */
    const duration =
      buildExperienceDurationSnapshot(
        ui.cvRef.current.experience,
        AAB389_REF,
      );

    const fin =
      finalizeCvAiFieldForApply({
        action: 'summary_shorter',
        field: 'summary',
        requestedLocale: locale,
        gender: 'male',
        cv: ui.cvRef.current,
        candidate: AAB389_BAD_PROVIDER,
        referenceDateIso: AAB389_REF,
        durationSnapshot: duration,
        rewriteStyle: 'shorter',
      });

    expect(fin.blocked).toBe(false);

    expect(
      fin.countedAsSuccess,
    ).toBe(true);

    const commit =
      commitSummaryApplyTransactionally({
        cvRef: ui.cvRef,
        ownership: ui.ownership,
        locale,
        finalized: fin,
        operationSourceText:
          beforeShorter,
        operationId:
          'aab411-real-shorter',
        scheduleReactCv: (next) => {
          ui.pendingReact = next;
        },
      });

    expect(commit.ok).toBe(true);

    const committed =
      String(
        ui.cvRef.current.summary || '',
      );

    const committedHash =
      aab389Hash(committed);

    expect(
      committedHash,
    ).not.toBe(
      beforeShorterHash,
    );

    expect(
      ui.ownership.authoritativeSummaryHash,
    ).toBe(committedHash);

    /*
     * We deliberately have NOT called flushReact().
     *
     * cvRef = Shorter result
     * reactCv = previous Summary
     */
    expect(
      aab389Hash(
        String(
          ui.reactCv.summary || '',
        ),
      ),
    ).toBe(beforeShorterHash);

    const staleSync =
      syncCvRefFromReactState({
        cvRef: ui.cvRef,
        ownership: ui.ownership,
        nextCv: ui.reactCv,
        currentSummaryHash:
          aab389Hash(
            String(
              ui.cvRef.current.summary || '',
            ),
          ),
        nextSummaryHash:
          aab389Hash(
            String(
              ui.reactCv.summary || '',
            ),
          ),
      });

    expect(
      staleSync.accepted,
    ).toBe(false);

    expect(
      staleSync.reason,
    ).toBe(
      'authoritative_summary_hash_mismatch',
    );

    /*
     * This is the AAB-410 failure point.
     */
    expect(
      aab389Hash(
        String(
          ui.cvRef.current.summary || '',
        ),
      ),
    ).toBe(committedHash);

    /*
     * Export BEFORE queued React commit.
     */
    const pdfBeforeFlush =
      resolveCvExportSourceAuthority(
        ui.cvRef.current,
        'modern-minimal',
      );

    const docxBeforeFlush =
      resolveCvExportSourceAuthority(
        ui.cvRef.current,
        'modern-minimal',
      );

    expect(
      aab389Hash(
        String(
          pdfBeforeFlush.summary || '',
        ),
      ),
    ).toBe(committedHash);

    expect(
      aab389Hash(
        String(
          docxBeforeFlush.summary || '',
        ),
      ),
    ).toBe(committedHash);

    /*
     * Now allow the correct queued React
     * commit to arrive.
     */
    ui.flushReact();

    expect(
      aab389Hash(
        String(
          ui.reactCv.summary || '',
        ),
      ),
    ).toBe(committedHash);

    const finalSync =
      syncCvRefFromReactState({
        cvRef: ui.cvRef,
        ownership: ui.ownership,
        nextCv: ui.reactCv,
        currentSummaryHash:
          aab389Hash(
            String(
              ui.cvRef.current.summary || '',
            ),
          ),
        nextSummaryHash:
          aab389Hash(
            String(
              ui.reactCv.summary || '',
            ),
          ),
      });

    expect(
      finalSync.accepted,
    ).toBe(true);

    const pdfAfterFlush =
      resolveCvExportSourceAuthority(
        ui.cvRef.current,
        'modern-minimal',
      );

    const docxAfterFlush =
      resolveCvExportSourceAuthority(
        ui.cvRef.current,
        'modern-minimal',
      );

    expect(
      pdfAfterFlush.summary,
    ).toBe(committed);

    expect(
      docxAfterFlush.summary,
    ).toBe(committed);
  });
});
