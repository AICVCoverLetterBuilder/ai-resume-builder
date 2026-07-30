/**
 * Build-291 → 292 Croatian Summary intro grammar:
 * - incomplete duration without `iskustva` must fail
 * - bare `u Atlas` company construction must fail
 * - deterministic builder emits `u tvrtki <employer>` + complete duration
 * - malformed provider → deterministic fallback, usage +1 once
 */
import { describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
  SUMMARY_RUNTIME_MARKER_SET,
} from '../cv-ai-finalize-apply';
import {
  analyzeCroatianSummaryEmploymentQuality,
  buildCroatianEntryOwnedSummary,
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  ensureCroatianDurationExperienceNoun,
  formatCroatianCompanyLocative,
  injectCroatianDurationIntoCurrentIntro,
  splitCroatianSummaryUnits,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
  validateCroatianSummaryIntroGrammar,
} from '../cv-croatian-summary-grounding';
import {
  formatApproximateDurationPhrase,
  buildExperienceDurationSnapshot,
} from '../cv-experience-duration';
import {
  countSummaryDurationExpressions,
  verifyIndependentFinalDurationCount,
} from '../cv-summary-duration-ownership';
import { formatExperienceBullets } from '../cv-canonical-facts';

const HR_WH = formatExperienceBullets([
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe.',
  'Surađuje s kolegicama i kolegama na koordinaciji pripreme i premještanja robe.',
]);

const JA_DESIGN = [
  'ビジュアル資料とグラフィック要素を作成した。',
  'デザイン資料を確認し、プロジェクト要件に合わせて調整した。',
  '各種画面向けの最終ファイルとフォーマットを準備した。',
].join('\n');

const MALFORMED_BUILD291 = [
  'Radnica u skladištu s ukupno oko šest i pol godina, zaposlena u Atlas od siječnja 2023.',
  'Ima iskustvo u provjeri zaprimljene robe i prateće dokumentacije, ažuriranju skladišne evidencije i održavanju urednog skladišta te koordinaciji pripreme i premještanja robe s kolegama.',
  'Prethodno je u tvrtki Rewitu radila kao grafička dizajnerica, gdje je izrađivala vizualne materijale i grafičke elemente, pregledavala i prilagođavala dizajnerske materijale zahtjevima projekta te pripremala završne datoteke i formate za različite zaslone.',
].join(' ');

function fixture(gender: string = 'female', employer: string = 'Atlas'): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      location: 'Zagreb',
      jobTitle: 'Radnica u skladištu',
      photo: '',
      gender,
    },
    summary: '',
    experience: [
      {
        id: 'exp-wh',
        company: employer,
        position: 'Radnica u skladištu',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: HR_WH,
        originalUserDescription: HR_WH,
        canonicalDescription: HR_WH,
      },
      {
        id: 'exp-design',
        company: 'Rewitu',
        position: 'グラフィックデザイナー',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: JA_DESIGN,
        originalUserDescription: JA_DESIGN,
        canonicalDescription: JA_DESIGN,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

describe('cv-build291 Croatian Summary intro grammar', () => {
  it('exposes intro-grammar + duration-v2 markers', () => {
    expect(CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION)
      .toBe('croatian-summary-intro-grammar-292-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2)
      .toBe('croatian-duration-idempotent-v2');
    expect(SUMMARY_RUNTIME_MARKER_SET).toEqual(expect.arrayContaining([
      CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
      SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
    ]));
  });

  it('rejects exact build-291 malformed Summary grammar', () => {
    const units = splitCroatianSummaryUnits(MALFORMED_BUILD291);
    expect(units.length).toBe(3);
    const grammar = validateCroatianSummaryIntroGrammar(MALFORMED_BUILD291, {
      company: 'Atlas',
    });
    expect(grammar.ok).toBe(false);
    expect(grammar.durationNounMissing).toBe(true);
    expect(grammar.invalidCompanyCase).toBe(true);
    expect(grammar.reason).toBe('croatian_summary_duration_noun_missing');

    const quality = analyzeCroatianSummaryEmploymentQuality(MALFORMED_BUILD291, {
      company: 'Atlas',
      role: 'Radnica u skladištu',
      structuredRole: 'Radnica u skladištu',
      currentEntryDuties: HR_WH,
      priorEntryDuties: JA_DESIGN,
      gender: 'female',
    });
    expect(quality.grammarValidationPassed).toBe(false);
    expect(quality.groundingValidationPassed).toBe(false);
    expect(quality.durationNounMissing).toBe(true);
    expect(quality.invalidCompanyCase).toBe(true);
    expect(quality.typedRejectionReason).toBe('croatian_summary_duration_noun_missing');
  });

  it('malformed provider is not applied; deterministic corrected Summary counts +1', () => {
    const cv = fixture();
    const snap = buildExperienceDurationSnapshot(cv.experience || [], new Date('2026-07-20'));
    expect(snap.total.totalMonths).toBe(78);

    const rejected = finalizeCvAiFieldForApply({
      field: 'summary',
      candidate: MALFORMED_BUILD291,
      requestedLocale: 'hr',
      cv,
      gender: 'female',
      durationSnapshot: snap,
      referenceDateIso: '2026-07-20',
    });
    // Direct finalize of malformed-only path: either blocked or rebuilt.
    // Full pipeline must select deterministic corrected candidate.
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'summary_professional',
      candidate: MALFORMED_BUILD291,
      durationSnapshot: snap,
      referenceDateIso: '2026-07-20',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.origin).toBe('deterministic_fallback');
    const text = pipe.finalized.text;
    if (!summaryV2ModeActive()) {
      expect(text).toMatch(/oko šest i pol godina iskustva/);
      expect(text).toMatch(/u tvrtki Atlas/);
      expect(splitCroatianSummaryUnits(text).length).toBe(3);
      expect(pipe.finalized.diagnostics?.finalUnitRoleSlots)
        .toEqual(['current_intro', 'current_duty', 'prior_role']);
      expect(pipe.finalized.diagnostics?.grammarValidationPassed).toBe(true);
      expect(pipe.finalized.diagnostics?.summaryDurationFinalizerRevision)
        .toBe(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2);
      expect(text).not.toMatch(/(?:zaposlena|zaposlen|radi)\s+u\s+Atlas\b/);
      expect(text).not.toMatch(/s ukupno oko šest i pol godina,/);
    } else {
      expectSummaryContractInvariants({
        text,
        locale: 'hr',
        cv,
        requirePrior: true,
      });
      expect(text).toMatch(/Atlas|Rewitu|godina/i);
    }
    expect(countSummaryDurationExpressions(text, 'hr')).toBe(1);
    expect(verifyIndependentFinalDurationCount(text, 'hr', { requireExactlyOne: true }).ok)
      .toBe(true);
    // Malformed must never be the visible final text.
    expect(text).not.toBe(MALFORMED_BUILD291);
    expect(rejected.text === MALFORMED_BUILD291 && rejected.countedAsSuccess).toBe(false);
  });

  it('deterministic builder emits complete female intro', () => {
    const text = buildCroatianEntryOwnedSummary({
      role: 'Radnica u skladištu',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 's ukupno oko šest i pol godina',
      dutyFacts: [
        { sourceText: 'Provjerava točnost zaprimljene robe i prateće dokumentacije.', value: 'a' },
        { sourceText: 'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe.', value: 'b' },
        { sourceText: 'Surađuje s kolegicama i kolegama na koordinaciji pripreme i premještanja robe.', value: 'c' },
      ],
      priorRole: 'グラフィックデザイナー',
      priorEmployer: 'Rewitu',
      priorSourceDuties: JA_DESIGN,
      locale: 'hr',
    });
    expect(text).toMatch(
      /Radnica u skladištu s ukupno oko šest i pol godina iskustva, zaposlena u tvrtki Atlas od siječnja 2023\./,
    );
    expect(text).toMatch(/grafička dizajnerica/);
    expect(text).toMatch(/u tvrtki Rewitu/);
  });

  it('male and unspecified gender forms', () => {
    const male = buildCroatianEntryOwnedSummary({
      role: 'Radnik u skladištu',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'male',
      durationPhrase: formatApproximateDurationPhrase(
        buildExperienceDurationSnapshot(fixture('male').experience, new Date('2026-07-20')).total,
        'hr',
      ) || 's ukupno oko šest i pol godina iskustva',
      dutyFacts: [
        { sourceText: 'Provjerava točnost zaprimljene robe i prateće dokumentacije.', value: 'a' },
        { sourceText: 'Ažurira skladišne evidencije.', value: 'b' },
        { sourceText: 'Surađuje s kolegama na premještanju robe.', value: 'c' },
      ],
      priorRole: 'グラフィックデザイナー',
      priorEmployer: 'Rewitu',
      priorSourceDuties: JA_DESIGN,
      locale: 'hr',
    });
    expect(male).toMatch(/zaposlen u tvrtki Atlas/);
    expect(male).toMatch(/grafički dizajner/);
    expect(male).not.toMatch(/zaposlena|dizajnerica|radila/);

    const neutral = buildCroatianEntryOwnedSummary({
      role: 'Warehouse',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'prefer_not',
      durationPhrase: 's ukupno oko šest i pol godina iskustva',
      dutyFacts: [
        { sourceText: 'Provjerava točnost zaprimljene robe i prateće dokumentacije.', value: 'a' },
        { sourceText: 'Ažurira skladišne evidencije.', value: 'b' },
        { sourceText: 'Surađuje s kolegama na premještanju robe.', value: 'c' },
      ],
      priorRole: 'グラフィックデザイナー',
      priorEmployer: 'Rewitu',
      priorSourceDuties: JA_DESIGN,
      locale: 'hr',
    });
    expect(neutral).toMatch(/Osoba s iskustvom u skladišnim poslovima/);
    expect(neutral).toMatch(/radi u tvrtki Atlas/);
    expect(neutral).toMatch(/oko šest i pol godina iskustva/);
    expect(neutral).not.toMatch(/zaposlena|zaposlen|dizajnerica|radila|radio/);
    expect(neutral).toMatch(/Prethodno iskustvo u tvrtki Rewitu/);
  });

  it('employer wrapper matrix keeps exact proper nouns', () => {
    const names = [
      'Atlas',
      'Rewitu',
      'IBM',
      'ACME',
      'ACME Solutions',
      'Studio 21',
      'Example d.o.o.',
    ];
    for (const name of names) {
      expect(formatCroatianCompanyLocative(name)).toBe(`u tvrtki ${name}`);
      const text = buildCroatianEntryOwnedSummary({
        role: 'Radnica u skladištu',
        employer: name,
        datesValue: '2023-01',
        gender: 'female',
        durationPhrase: 's ukupno oko šest i pol godina iskustva',
        dutyFacts: [
          { sourceText: 'Provjerava točnost zaprimljene robe i prateće dokumentacije.', value: 'a' },
          { sourceText: 'Ažurira skladišne evidencije.', value: 'b' },
        ],
        locale: 'hr',
      });
      expect(text).toContain(`u tvrtki ${name}`);
      expect(text).not.toMatch(new RegExp(`zaposlena\\s+u\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
      expect(text).not.toMatch(/u tvrtki tvrtki/i);
    }
    expect(formatCroatianCompanyLocative('')).toBeNull();
    expect(formatCroatianCompanyLocative('   ')).toBeNull();
    expect(formatCroatianCompanyLocative('Tvrtka Atlas')).toBe('u Tvrtka Atlas');
    expect(formatCroatianCompanyLocative('tvrtki Atlas')).toBe('u tvrtki Atlas');
    expect(formatCroatianCompanyLocative('Example, Inc.')).toBe('u tvrtki Example, Inc.');
  });

  it('duration inject v2 keeps iskustva and stays idempotent', () => {
    const snap = buildExperienceDurationSnapshot(fixture().experience, new Date('2026-07-20'));
    const incomplete = 'Radnica u skladištu, zaposlena u tvrtki Atlas od siječnja 2023. Ima iskustvo u provjeri robe.';
    const pass1 = injectCroatianDurationIntoCurrentIntro(incomplete, snap.total);
    const pass2 = injectCroatianDurationIntoCurrentIntro(pass1, snap.total);
    expect(pass1).toBe(pass2);
    expect(pass1).toMatch(/oko šest i pol godina iskustva/);
    expect(ensureCroatianDurationExperienceNoun(
      's ukupno oko šest i pol godina, zaposlena',
    )).toMatch(/godina iskustva/);
    expect(countSummaryDurationExpressions(pass1, 'hr')).toBe(1);
  });

  it('50× reordered Summary still emits grammatical intro', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = fixture();
      if (i % 2 === 1) {
        cv.experience = [cv.experience[1]!, cv.experience[0]!];
      }
      const snap = buildExperienceDurationSnapshot(cv.experience || [], new Date('2026-07-20'));
      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'hr',
        action: 'summary_professional',
        candidate: i % 3 === 0 ? MALFORMED_BUILD291 : 'bad',
        durationSnapshot: snap,
        referenceDateIso: '2026-07-20',
      });
      expect(pipe.finalized.countedAsSuccess).toBe(true);
      if (!summaryV2ModeActive()) {
        expect(pipe.finalized.text).toMatch(/oko šest i pol godina iskustva/);
        expect(pipe.finalized.text).toMatch(/u tvrtki Atlas/);
        expect(pipe.finalized.diagnostics?.grammarValidationPassed).toBe(true);
        expect(pipe.finalized.diagnostics?.summaryDurationFinalizerRevision)
          .toBe(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2);
      } else {
        expect(pipe.finalized.text).toMatch(/Atlas|Rewitu|godina/i);
      }
    }
  });
});
