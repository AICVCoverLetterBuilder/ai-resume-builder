/**
 * @vitest-environment jsdom
 *
 * Build 265 — Serbian Professional Summary:
 * - exactly one structured-date duration phrase
 * - no mixed Latin/Cyrillic tokens (pregledа → pregleda)
 * - preserve singular "najnovijim statusom"
 *
 * Does not modify Experience AI bullet perspective pipeline.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyApproximateDurationPolicy,
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  monthsBetweenYearMonths,
} from '@/lib/cv-experience-duration';
import {
  resolveSummaryWithDurationPolicy,
} from '@/lib/cv-content-quality';
import {
  countSummaryDurationExpressions,
  enforceAuthoritativeSummaryDuration,
  stripAllSummaryDurationExpressions,
} from '@/lib/cv-summary-duration-ownership';
import {
  hasSerbianLatinMixedScriptToken,
  normalizeSerbianLatinConfusables,
  preserveSerbianSummaryFactForms,
} from '@/lib/cv-serbian-latin-script';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2026-07-17';

const SR_DUTIES = [
  'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
  'Ažurira zajedničku tabelu sa najnovijim statusom.',
  'Koordiniše sa dva interna odeljenja kada nedostaju informacije.',
].join('\n');

/** Exact build-265 provider output (duplicate duration + mixed script + statusima). */
const BUILD265_PROVIDER = [
  'Koordinator terenske dokumentacije sa oko godinu dana iskustva, koji',
  'pregled\u0430 pristigle terenske izveštaje i označava nepotpune unose, ažurira',
  'zajedničku tabelu sa najnovijim statusima i koordiniše sa dva interna odeljenja',
  'kada nedostaju informacije, sa oko jedne i po godine iskustva. Ključne veštine',
  'uključuju organizaciju, komunikaciju, kritičko razmišljanje, upravljanje',
  'vremenom i pažnju prema detaljima.',
].join(' ');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function build265Cv(overrides?: Partial<WorkExperience>): CVData {
  const exp: WorkExperience = {
    id: 'exp-265',
    company: 'Atlas',
    position: 'Koordinator terenske dokumentacije',
    startDate: '2025-03',
    endDate: '',
    isPresent: true,
    description: SR_DUTIES,
    canonicalDescription: SR_DUTIES,
    originalUserDescription: SR_DUTIES,
    generatedDescription: '',
    descriptionOrigin: 'user',
    ...overrides,
  };
  return {
    id: 'cv-265',
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      address: '',
      jobTitle: 'Koordinator terenske dokumentacije',
      gender: 'male',
    },
    summary: '',
    experience: [exp],
    education: [],
    skills: [
      'Organizacija',
      'Komunikacija',
      'Kritičko razmišljanje',
      'Upravljanje vremenom',
      'Pažnja prema detaljima',
    ],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    contentLocale: 'sr',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function runExactBuild265(opts?: { usageBefore?: number; candidate?: string }) {
  const usageBefore = opts?.usageBefore ?? 11;
  seedUsage(usageBefore);
  const cv = build265Cv();
  const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
  const finalized = finalizeCvAiFieldForApply({
    action: 'summary_generate',
    field: 'summary',
    requestedLocale: 'sr',
    gender: 'male',
    cv,
    candidate: opts?.candidate ?? BUILD265_PROVIDER,
    durationSnapshot,
    referenceDateIso: REF,
    originHint: 'ai_generated',
  });

  let nextCv = cv;
  let usageAfter = usageBefore;
  if (finalized.countedAsSuccess && !finalized.blocked) {
    nextCv = applyFinalizedSummaryToCv(cv, 'sr', finalized);
    recordProAiUserActionSuccess();
    usageAfter = getProAiUsageCount();
  }

  return { finalized, nextCv, usageBefore, usageAfter, durationSnapshot };
}

describe('build 265 — duration ownership unit', () => {
  it('March 2025 → July 2026 is 16 months / 1.5 years', () => {
    expect(monthsBetweenYearMonths('2025-03', '2026-07')).toBe(16);
    const d = applyApproximateDurationPolicy(16);
    expect(d.approxYears).toBe(1.5);
    expect(formatApproximateDurationPhrase(d, 'sr')).toBe(
      'sa oko jedne i po godine iskustva',
    );
  });

  it('strips both godinu dana and jedne i po, injects once', () => {
    const d = applyApproximateDurationPolicy(16);
    const owned = enforceAuthoritativeSummaryDuration(BUILD265_PROVIDER, d, 'sr', {
      requireDurationClaim: true,
    });
    expect(owned.diagnostics.summaryDurationExpressionCount).toBeGreaterThanOrEqual(2);
    expect(owned.diagnostics.duplicateDurationRemoved).toBe(true);
    expect(owned.diagnostics.finalDurationExpressionCount).toBe(1);
    expect(owned.summary).toMatch(/sa oko jedne i po godine iskustva/i);
    expect(owned.summary).not.toMatch(/godinu dana/i);
    expect(countSummaryDurationExpressions(owned.summary, 'sr')).toBe(1);
  });

  it('normalizeSerbianLatinConfusables fixes pregledа', () => {
    const mixed = 'pregled\u0430';
    expect(hasSerbianLatinMixedScriptToken(mixed)).toBe(true);
    expect(normalizeSerbianLatinConfusables(mixed)).toBe('pregleda');
    expect(hasSerbianLatinMixedScriptToken(normalizeSerbianLatinConfusables(mixed))).toBe(false);
  });

  it('preserves singular statusom from source', () => {
    const out = preserveSerbianSummaryFactForms(
      'ažurira tabelu sa najnovijim statusima.',
      SR_DUTIES,
    );
    expect(out).toMatch(/najnovijim statusom/i);
    expect(out).not.toMatch(/statusima/i);
  });
});

describe('build 265 — exact Serbian Summary regression', () => {
  beforeEach(() => seedUsage(11));

  it('exact fixture: one duration, latin script, statusom, usage 11→12', () => {
    const { finalized, nextCv, usageBefore, usageAfter, durationSnapshot } = runExactBuild265();

    expect(durationSnapshot.total.approxYears).toBe(1.5);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.blocked).toBe(false);

    const text = finalized.text;
    expect(text).toMatch(/Koordinator terenske dokumentacije/i);
    expect(text).toMatch(/Atlas|mart|2025/i);
    expect(countSummaryDurationExpressions(text, 'sr')).toBe(1);
    // V2 finite form is "Imam oko …"; legacy phrase remains "sa oko …".
    expect(text).toMatch(/(?:Imam|sa) oko jedne i po godine iskustva/i);
    expect(text).not.toMatch(/godinu dana/i);
    // Cannot coexist
    expect(
      /godinu dana/i.test(text) && /jedne i po/i.test(text),
    ).toBe(false);

    expect(text).toMatch(/terenske izveštaje|pregled/i);
    expect(text).toMatch(/nepotpune unose|označav/i);
    expect(text).toMatch(/zajedničk/i);
    expect(text).toMatch(/najnovijim statusom/i);
    expect(text).not.toMatch(/statusima/i);
    expect(text).toMatch(/dva interna odeljenja/i);
    expect(text).toMatch(/nedostaju informacije/i);

    expect(hasSerbianLatinMixedScriptToken(text)).toBe(false);
    expect(text).not.toMatch(/pregled\u0430/);
    expect(text).not.toMatch(/[•\u2022]/);
    expect(text).not.toMatch(/Excel|KPI|leadership|achievement/i);
    expect(text).not.toMatch(/obavlja dodeljene profesionalne zadatke/i);

    expect(nextCv.summary).toBe(text);
    expect(usageBefore).toBe(11);
    expect(usageAfter).toBe(12);
    if (!summaryV2ModeActive()) {
      expect(finalized.diagnostics?.finalDurationExpressionCount).toBe(1);
      expect(finalized.diagnostics?.duplicateDurationRemoved).toBe(true);
    } else {
      expect(countSummaryDurationExpressions(text, 'sr')).toBe(1);
    }
  });

  it('50× exact fixture — zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const { finalized, usageAfter } = runExactBuild265({ usageBefore: 11 });
      expect(finalized.countedAsSuccess, `rep ${i}`).toBe(true);
      expect(countSummaryDurationExpressions(finalized.text, 'sr'), `rep ${i}`).toBe(1);
      expect(finalized.text, `rep ${i}`).toMatch(/najnovijim statusom/i);
      expect(hasSerbianLatinMixedScriptToken(finalized.text), `rep ${i}`).toBe(false);
      expect(usageAfter, `rep ${i}`).toBe(12);
    }
  });

  it('rejected duplicate-duration without success path increments zero', () => {
    seedUsage(11);
    // Empty CV duties so finalize cannot fall back → blocked, no usage.
    const cv = build265Cv({
      description: '',
      canonicalDescription: '',
      originalUserDescription: '',
    });
    cv.skills = [];
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'sr',
      gender: 'male',
      cv,
      candidate: 'sa oko godinu dana iskustva, sa oko jedne i po godine iskustva.',
      durationSnapshot,
      referenceDateIso: REF,
      originHint: 'ai_generated',
    });
    if (!finalized.countedAsSuccess) {
      expect(getProAiUsageCount()).toBe(11);
    }
  });
});

describe('build 265 — generalization', () => {
  it('provider wrong duration + two durations → one authoritative', () => {
    const d = applyApproximateDurationPolicy(16);
    const dual = 'Role sa oko godinu dana iskustva and also sa oko jedne i po godine iskustva. Duties here.';
    const r = resolveSummaryWithDurationPolicy(dual, d, 'sr', {
      forceDurationPhrase: true,
      requireDurationClaim: true,
    });
    expect(countSummaryDurationExpressions(r.summary, 'sr')).toBe(1);
    expect(r.summary).toMatch(/jedne i po/i);
    expect(r.summary).not.toMatch(/godinu dana/i);
  });

  it('multilingual: at most one duration expression', () => {
    const d = applyApproximateDurationPolicy(16);
    const samples: Array<{ locale: Locale; text: string }> = [
      { locale: 'en', text: 'Engineer with around one year of experience, with approximately one and a half years of experience. Reviews reports.' },
      { locale: 'de', text: 'Fachkraft mit etwa einem Jahr Erfahrung, mit etwa 1,5 Jahren Erfahrung. Prüft Berichte.' },
      { locale: 'es', text: 'Profesional con alrededor de un años de experiencia, con alrededor de uno y medio años de experiencia.' },
      { locale: 'hi', text: 'मैं लगभग एक वर्षों के अनुभव वाला पेशेवर हूँ। मैं लगभग डेढ़ वर्षों के अनुभव वाला पेशेवर हूँ।' },
      { locale: 'ja', text: 'プロフェッショナル約1年の経験。約1.5年の経験。' },
      { locale: 'sr', text: BUILD265_PROVIDER },
    ];
    for (const { locale, text } of samples) {
      const r = resolveSummaryWithDurationPolicy(text, d, locale, {
        forceDurationPhrase: true,
        requireDurationClaim: true,
        context: { role: 'Professional' },
      });
      expect(countSummaryDurationExpressions(r.summary, locale), locale).toBeLessThanOrEqual(1);
      if (d.hasValidDates) {
        expect(countSummaryDurationExpressions(r.summary, locale), locale).toBe(1);
      }
    }
  });

  it('Cyrillic Serbian summary is not forced to Latin', () => {
    const cyr = 'Координатор са око једне и по године искуства прегледа извештаје.';
    expect(normalizeSerbianLatinConfusables(cyr)).toBe(cyr);
  });

  it('no dates → strip freestyle durations', () => {
    const empty = applyApproximateDurationPolicy(0);
    expect(empty.hasValidDates).toBe(false);
    const stripped = stripAllSummaryDurationExpressions(
      'Role sa oko godinu dana iskustva. Duties.',
      'sr',
    );
    expect(stripped).not.toMatch(/godinu dana|iskustva/i);
  });
});

describe('build 265 — reload / PDF / DOCX', () => {
  beforeEach(() => seedUsage(11));

  it('reload + PDF/DOCX show repaired Summary; export +0', async () => {
    const { finalized, nextCv, usageAfter } = runExactBuild265();
    expect(usageAfter).toBe(12);
    expect(countSummaryDurationExpressions(finalized.text, 'sr')).toBe(1);

    const reloaded: CVData = JSON.parse(JSON.stringify(nextCv));
    expect(reloaded.summary).toBe(finalized.text);
    expect(reloaded.summary).toMatch(/najnovijim statusom/i);
    expect(hasSerbianLatinMixedScriptToken(reloaded.summary || '')).toBe(false);

    const beforeExport = getProAiUsageCount();
    const prepared = prepareExportReadyCv(reloaded, 'sr');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfFlat = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer())).replace(/\u0000/g, '');
    expect(pdfFlat).toMatch(/jedne i po|godine iskustva/i);
    expect(pdfFlat).not.toMatch(/godinu dana/i);
    expect(pdfFlat).toMatch(/statusom/i);
    await exportToDOCX(prepared.cv, 'cv-265', 'sr', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(beforeExport);
  });
});
