/**
 * @vitest-environment jsdom
 *
 * Build 258: Universal Professional Summary must preserve all authoritative
 * Experience facts for arbitrary known and unknown occupations — no bullet
 * leakage, no first-duty-only collapse, no bare skills fragments.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData } from '@/lib/types';
import {
  buildCvCanonicalFactSet,
  formatExperienceBullets,
} from '@/lib/cv-canonical-facts';
import {
  buildConciseGroundedSummary,
  buildSummaryCompositionDiagnostics,
  runSummaryGroundingValidators,
  summaryHasMalformedSkillsFragment,
} from '@/lib/cv-summary-grounding';
import {
  dutyToEnglishGerundFragment,
  sanitizeSummaryListMarkers,
  stripDutyListPrefix,
  summaryContainsListMarkerLeakage,
  validateSummarySourceFactCoverage,
} from '@/lib/cv-source-fact-identity';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import {
  activateCvSummary,
  deterministicSummaryFromCanonical,
} from '@/lib/cv-content-activation';
import { runCvAiApplyPipeline } from '@/lib/cv-ai-finalize-apply';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import { getProAiUsageCount, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
} from '@/lib/cv-experience-duration';
import { validateLocalizedSummary } from '@/lib/cv-semantic-fidelity';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2026-07-17';

const USER_DUTIES = [
  'Review incoming field reports and mark incomplete entries.',
  'Update the shared tracking sheet with the latest status.',
  'Coordinate with two internal departments when information is missing.',
];

const FINALIZED_EXP = formatExperienceBullets([
  'Reviews incoming field reports and marks incomplete entries for follow-up.',
  'Updates the shared tracking sheet with the latest status information.',
  'Coordinates with two internal departments to resolve missing information gaps.',
]);

const MALFORMED_SUMMARY =
  'Custom Title XYZ-47. • Review incoming field reports and mark incomplete entries, with approximately one and a half years of experience. Presentation Skills, Leadership, Organization, Critical Thinking, Adaptability.';

const SKILLS = [
  'Presentation Skills',
  'Leadership',
  'Organization',
  'Critical Thinking',
  'Adaptability',
];

const PROPERTY_SEED = 258001;

function build258Cv(overrides?: Partial<CVData>): CVData {
  const userBlock = USER_DUTIES.join('\n');
  return {
    id: 'cv-258',
    name: 'CV',
    personal: {
      fullName: 'Jordan Atlas',
      email: 'jordan@example.com',
      phone: '',
      address: '',
      jobTitle: 'Custom Title XYZ-47',
      gender: 'male',
      photoEnabled: false,
    },
    summary: MALFORMED_SUMMARY,
    summaryOrigin: 'ai_generated',
    contentLocale: 'en',
    summaryGeneratedLocale: 'en',
    experience: [{
      id: 'exp-1',
      company: 'Atlas',
      position: 'Custom Title XYZ-47',
      startDate: '2025-03',
      endDate: '',
      isPresent: true,
      description: FINALIZED_EXP,
      originalUserDescription: userBlock,
      canonicalDescription: userBlock,
      descriptionOrigin: 'ai_generated',
    }],
    education: [],
    skills: [...SKILLS],
    certifications: [],
    languages: [{ name: 'English', level: 'native' }],
    templateId: 'modern-minimal',
    region: 'US',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function assertThreeMaterialFacts(text: string, label: string) {
  expect(text, `${label}: field reports`).toMatch(/field\s+reports?/i);
  expect(text, `${label}: tracking sheet`).toMatch(/tracking\s+sheet/i);
  expect(text, `${label}: departments`).toMatch(/departments?/i);
  expect(text, `${label}: no bullet`).not.toMatch(/[•\u2022]/);
  expect(text, `${label}: no bare skills`).not.toMatch(
    /(?:^|[.!?]\s+)(?:Presentation Skills|Leadership|Organization)(?:,\s*(?:Leadership|Organization|Critical Thinking|Adaptability))+\./,
  );
}

function assertNoListLeakage(text: string) {
  expect(summaryContainsListMarkerLeakage(text)).toBe(false);
  expect(summaryHasMalformedSkillsFragment(text)).toBe(false);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

describe('build-258 exact unknown-title Summary regression', () => {
  beforeEach(() => {
    // usage counter is localStorage-backed in jsdom
  });

  it('rejects the exact malformed device Summary', () => {
    const cv = build258Cv();
    const factSet = buildCvCanonicalFactSet(cv);
    const check = validateLocalizedSummary(MALFORMED_SUMMARY, factSet, {
      locale: 'en',
      gender: 'male',
      expectedDuration: buildExperienceDurationSnapshot(cv.experience, REF).total,
    });
    expect(check.valid).toBe(false);
    const kinds = check.violations.map((v) => v.kind);
    expect(kinds.some((k) =>
      k === 'summary_list_marker_leakage'
      || k === 'summary_material_fact_coverage_incomplete'
      || k === 'summary_malformed_skills_fragment'
      || k === 'summary_missing_material_fact',
    )).toBe(true);
  });

  it('deterministic grounded Summary preserves all three facts without bullets', () => {
    const cv = build258Cv({ summary: '' });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    const text = buildConciseGroundedSummary(factSet, 'en', 'male', duration, {
      includeSkills: true,
    });
    assertThreeMaterialFacts(text, 'grounded');
    assertNoListLeakage(text);
    expect(text).toMatch(/approximately one and a half years of experience/i);
    expect((text.match(/approximately one and a half years of experience/gi) || []).length).toBe(1);
    expect(text).toMatch(/Custom Title XYZ-47/);
    expect(text).toMatch(/Atlas/);
    if (/Key skills include/i.test(text)) {
      expect(text).toMatch(/Key skills include/i);
      expect(text).not.toMatch(/Presentation Skills,\s*Leadership,\s*Organization/);
    }
    const coverage = validateSummarySourceFactCoverage(
      (cv.experience || [])[0].originalUserDescription || '',
      text,
    );
    expect(coverage.ok).toBe(true);
    expect(coverage.requiredIds.length).toBe(3);
  });

  it('export recovers malformed Summary; PDF and DOCX match; zero AI usage', async () => {
    const cv = build258Cv();
    const usageBefore = getProAiUsageCount();
    const prepared = prepareExportReadyCv(cv, 'en', 'modern-minimal', {
      referenceDate: REF,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const summary = prepared.cv.summary;
    assertThreeMaterialFacts(summary, 'export');
    assertNoListLeakage(summary);
    expect(summary).toMatch(/approximately one and a half years of experience/i);
    expect((summary.match(/approximately one and a half years of experience/gi) || []).length).toBe(1);
    expect(prepared.diagnostics.summaryMaterialCoverageResult).toBe('complete');
    expect(prepared.diagnostics.summarySourceFactCount).toBe(3);
    expect(prepared.diagnostics.summaryCoveredFactCount).toBe(3);
    expect(prepared.diagnostics.summaryRecoverySource).toBe('deterministic_semantic_facts');
    expect(prepared.diagnostics.occupationGenericFallbackUsed).not.toBe(true);

    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'en');
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    assertThreeMaterialFacts(pdfText, 'pdf');
    expect(pdfText).toMatch(/approximately one and a half years of experience/i);

    const docx = await exportToDOCX(prepared.cv, 'build258-xyz47', 'en', 'modern-minimal');
    expect(docx).toBeTruthy();
    // Same prepareExportReadyCv snapshot feeds preview/PDF/DOCX.
    expect(prepared.cv.summary).toBe(summary);

    expect(getProAiUsageCount()).toBe(usageBefore);

    // Reload-style: re-prepare the corrected CV keeps the Summary
    const reloaded = prepareExportReadyCv(
      { ...prepared.cv, summary: prepared.cv.summary, summaryOrigin: 'deterministic_fallback' },
      'en',
      'modern-minimal',
      { referenceDate: REF },
    );
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) {
      expect(reloaded.cv.summary).toBe(prepared.cv.summary);
    }
  }, 60_000);

  it('50× cold exact fixture is flake-free', async () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = build258Cv();
      const prepared = prepareExportReadyCv(cv, 'en', 'modern-minimal', {
        referenceDate: REF,
      });
      expect(prepared.ok, `cold ${i}`).toBe(true);
      if (!prepared.ok) return;
      assertThreeMaterialFacts(prepared.cv.summary, `cold ${i}`);
      assertNoListLeakage(prepared.cv.summary);
      expect(prepared.cv.summary).toMatch(/approximately one and a half years of experience/i);
    }
  });

  it('rejected incomplete Summary consumes zero usage; valid apply increments once', () => {
    const before = getProAiUsageCount();
    // Pure rejection path: validators fail the malformed text; no usage API called.
    const cv = build258Cv({ summary: '' });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    const check = validateLocalizedSummary(MALFORMED_SUMMARY, factSet, {
      locale: 'en',
      gender: 'male',
      expectedDuration: duration,
    });
    expect(check.valid).toBe(false);
    expect(getProAiUsageCount()).toBe(before);

    // Apply path: candidate rejected internally, deterministic fallback applied once.
    const applied = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'summary',
      candidate: MALFORMED_SUMMARY,
      referenceDateIso: REF,
    });
    expect(applied.blocked).toBe(false);
    expect(applied.finalized.origin).toBe('deterministic_fallback');
    assertThreeMaterialFacts(applied.finalized.text, 'fallback-apply');
    if (applied.finalized.countedAsSuccess) {
      recordProAiUserActionSuccess();
    }
    expect(getProAiUsageCount()).toBe(before + 1);
  });
});

describe('build-258 bullet-marker sanitation', () => {
  it('strips leading list syntax only', () => {
    expect(stripDutyListPrefix('• Review reports')).toBe('Review reports');
    expect(stripDutyListPrefix('- Update sheet')).toBe('Update sheet');
    expect(stripDutyListPrefix('– Coordinate teams')).toBe('Coordinate teams');
    expect(stripDutyListPrefix('— Monitor climate')).toBe('Monitor climate');
    expect(stripDutyListPrefix('* Check inventory')).toBe('Check inventory');
    expect(stripDutyListPrefix('1. First duty here')).toBe('First duty here');
    expect(stripDutyListPrefix('2) Second duty here')).toBe('Second duty here');
    expect(stripDutyListPrefix('Review A, B, and C')).toBe('Review A, B, and C');
  });

  it('sanitizes leaked markers in prose', () => {
    const dirty = 'Role. • Review reports and update sheets.';
    const clean = sanitizeSummaryListMarkers(dirty);
    expect(clean).not.toMatch(/[•\u2022]/);
    expect(summaryContainsListMarkerLeakage(clean)).toBe(false);
  });

  it('gerund conversion preserves meaning', () => {
    expect(dutyToEnglishGerundFragment('Review incoming field reports')).toMatch(/^reviewing/i);
    expect(dutyToEnglishGerundFragment('Updates the shared tracking sheet')).toMatch(/^updating/i);
    expect(dutyToEnglishGerundFragment('Coordinate with two internal departments')).toMatch(/^coordinating/i);
  });
});

describe('build-258 known and unknown title matrix', () => {
  const KNOWN = [
    'Accountant',
    'Teacher',
    'Electrician',
    'Graphic Designer',
    'Warehouse Worker',
  ];
  const UNKNOWN = [
    'Custom Title XYZ-47',
    'Solar Drone Maintenance Coordinator',
    'Museum Lighting Technician',
    'Archive Climate Monitoring Assistant',
    'Unknown Role Q-900',
  ];
  const LOCALES: Locale[] = ['en', 'sr', 'hi'];
  const MARKERS = ['• ', '- ', '* ', '1. ', ''];

  function dutiesFor(n: number, marker: string): string[] {
    const base = [
      'Review operational records and flag incomplete entries.',
      'Update the shared tracking sheet with the latest status.',
      'Coordinate with two internal departments when information is missing.',
      'Document weekly progress for the operations lead.',
      'Verify schedule changes against the posted roster.',
    ];
    return base.slice(0, n).map((d) => `${marker}${d}`);
  }

  function cvFor(
    title: string,
    locale: Locale,
    dutyCount: number,
    marker: string,
    present: boolean,
  ): CVData {
    const lines = dutiesFor(dutyCount, marker);
    const block = lines.join('\n');
    return {
      id: `cv-${title}-${dutyCount}`,
      name: 'CV',
      personal: {
        fullName: 'Pat Example',
        email: 'p@example.com',
        phone: '',
        address: '',
        jobTitle: title,
        gender: 'female',
        photoEnabled: false,
      },
      summary: '',
      summaryOrigin: 'user',
      contentLocale: locale,
      experience: [{
        id: 'e1',
        company: 'Atlas',
        position: title,
        startDate: present ? '2025-03' : '2023-01',
        endDate: present ? '' : '2024-06',
        isPresent: present,
        description: formatExperienceBullets(lines.map(stripDutyListPrefix)),
        originalUserDescription: block,
        canonicalDescription: block,
        descriptionOrigin: 'user',
      }],
      education: [],
      skills: ['Organization', 'Critical Thinking'],
      certifications: [],
      languages: [],
      templateId: 'modern-minimal',
      region: 'US',
      createdAt: '',
      updatedAt: '',
    };
  }

  function assertCoverage(cv: CVData, summary: string, locale: Locale) {
    if (locale === 'en') {
      const source = (cv.experience || [])[0].originalUserDescription || '';
      const coverage = validateSummarySourceFactCoverage(source, summary);
      expect(coverage.ok, summary).toBe(true);
      assertNoListLeakage(summary);
    } else {
      assertNoListLeakage(summary);
      expect(summary.trim().length).toBeGreaterThan(10);
    }
  }

  for (const title of [...KNOWN, ...UNKNOWN]) {
    for (const n of [1, 2, 3, 5]) {
      it(`${title} / ${n} duties / en current`, () => {
        const cv = cvFor(title, 'en', n, pick(() => 0.2, MARKERS), true);
        const factSet = buildCvCanonicalFactSet(cv);
        const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
        const text = deterministicLocalizedSummaryFromCanonical(factSet, 'en', 'female', duration);
        expect(text.trim()).not.toBe('');
        assertCoverage(cv, text, 'en');
        expect(validateSummarySourceFactCoverage(
          (cv.experience || [])[0].originalUserDescription || '',
          text,
        ).requiredIds.length).toBe(n);
      });
    }
  }

  for (const locale of LOCALES) {
    it(`locale ${locale} unknown title with 3 duties`, () => {
      const cv = cvFor('Archive Climate Monitoring Assistant', locale, 3, '• ', true);
      const factSet = buildCvCanonicalFactSet(cv);
      const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
      const text = deterministicLocalizedSummaryFromCanonical(factSet, locale, 'female', duration);
      expect(text.trim()).not.toBe('');
      assertCoverage(cv, text, locale);
    });
  }

  it('provider keeps only first fact → rejected; fallback covers all', async () => {
    const cv = build258Cv({ summary: '' });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    const bad = 'Custom Title XYZ-47. • Review incoming field reports and mark incomplete entries.';
    const activation = await activateCvSummary({
      locale: 'en',
      gender: 'male',
      factSet,
      candidate: bad,
      sourceFactsText: USER_DUTIES.join('\n'),
      fallbackSummary: '',
      duration,
    });
    expect(activation.status === 'fallback' || activation.status === 'blocked' || activation.content).toBeTruthy();
    if (activation.content) {
      assertThreeMaterialFacts(activation.content, 'activation-fallback');
      assertNoListLeakage(activation.content);
    }
  });

  it('legacy deterministicSummaryFromCanonical never emits bare skills list', () => {
    const cv = build258Cv({ summary: '' });
    const factSet = buildCvCanonicalFactSet(cv);
    const text = deterministicSummaryFromCanonical(factSet, '', { locale: 'en', gender: 'male' });
    expect(summaryHasMalformedSkillsFragment(text)).toBe(false);
    assertThreeMaterialFacts(text, 'legacy-det');
  });
});

describe('build-258 property matrix', () => {
  it(`fixed seed ${PROPERTY_SEED} ≥100 combinations`, () => {
    const rng = mulberry32(PROPERTY_SEED);
    const titles = [
      'Accountant',
      'Teacher',
      'Electrician',
      'Custom Title XYZ-47',
      'Solar Drone Maintenance Coordinator',
      'Museum Lighting Technician',
      'Unknown Role Q-900',
      'Archive Climate Monitoring Assistant',
      'Graphic Designer',
      'Warehouse Worker',
    ];
    const locales: Locale[] = ['en', 'sr', 'hi'];
    const markers = ['• ', '- ', '* ', '1. ', '– ', ''];
    const dutyPools = [
      'Review operational records and flag incomplete entries.',
      'Update the shared tracking sheet with the latest status.',
      'Coordinate with two internal departments when information is missing.',
      'Document weekly progress for the operations lead.',
      'Verify schedule changes against the posted roster.',
    ];
    const skillPool = [
      'Organization',
      'Critical Thinking',
      'Adaptability',
      'Communication',
      'Leadership',
      'Presentation Skills',
      'Time Management',
      'Teamwork',
      'Creativity',
      'Problem Solving',
    ];

    let combinations = 0;
    for (let i = 0; i < 100; i += 1) {
      const title = pick(rng, titles);
      const locale = pick(rng, locales);
      const dutyCount = 1 + Math.floor(rng() * 5);
      const marker = pick(rng, markers);
      const present = rng() > 0.4;
      const skillCount = Math.floor(rng() * 11);
      const duties = dutyPools.slice(0, dutyCount).map((d) => `${marker}${d}`);
      const skills = skillPool.slice(0, skillCount);
      const block = duties.join('\n');
      const cv: CVData = {
        id: `prop-${i}`,
        name: 'CV',
        personal: {
          fullName: 'Prop User',
          email: 'p@x.com',
          phone: '',
          address: '',
          jobTitle: title,
          gender: rng() > 0.5 ? 'male' : 'female',
          photoEnabled: false,
        },
        summary: '',
        experience: [{
          id: 'e1',
          company: 'Atlas',
          position: title,
          startDate: present ? '2025-03' : '2022-01',
          endDate: present ? '' : '2024-01',
          isPresent: present,
          description: formatExperienceBullets(duties.map(stripDutyListPrefix)),
          originalUserDescription: block,
          canonicalDescription: block,
          descriptionOrigin: 'user',
        }],
        education: [],
        skills,
        certifications: [],
        languages: [],
        templateId: 'modern-minimal',
        region: 'US',
        createdAt: '',
        updatedAt: '',
      };

      const factSet = buildCvCanonicalFactSet(cv);
      const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
      const text = deterministicLocalizedSummaryFromCanonical(
        factSet,
        locale,
        cv.personal.gender,
        duration,
      );

      // Inject provider failure modes and ensure validators catch them.
      const providerOmits = `• ${stripDutyListPrefix(duties[0])}`;
      const omitCheck = runSummaryGroundingValidators(providerOmits, factSet, { locale });
      if (dutyCount > 1 && locale === 'en') {
        expect(omitCheck.some((v) =>
          v.kind === 'summary_material_fact_coverage_incomplete'
          || v.kind === 'summary_list_marker_leakage',
        )).toBe(true);
      }

      const withDupSkills = `${text} Organization, Leadership, Critical Thinking, Adaptability.`;
      if (locale === 'en' && summaryHasMalformedSkillsFragment(withDupSkills)) {
        expect(runSummaryGroundingValidators(withDupSkills, factSet, { locale }).length).toBeGreaterThan(0);
      }

      expect(text.trim().length).toBeGreaterThan(0);
      assertNoListLeakage(text);
      if (locale === 'en') {
        const coverage = validateSummarySourceFactCoverage(block, text);
        expect(coverage.ok, `combo ${i}: ${text}`).toBe(true);
        expect(coverage.requiredIds.length).toBe(dutyCount);
        if (duration.hasValidDates && duration.unit === 'years' && duration.approxYears > 0) {
          const phrase = formatApproximateDurationPhrase(duration, 'en');
          const count = (text.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
          // Duration may be omitted only when builder could not place it; when present, once.
          expect(count === 0 || count === 1).toBe(true);
        }
      }
      const diag = buildSummaryCompositionDiagnostics(factSet, text);
      expect(diag.summaryMaterialCoverageResult === 'complete'
        || diag.summaryMaterialCoverageResult === 'empty_source'
        || locale !== 'en').toBe(true);
      combinations += 1;
    }
    expect(combinations).toBe(100);
    expect(PROPERTY_SEED).toBe(258001);
  });
});

describe('build-258 skills composition', () => {
  it('never appends bare comma-separated skills', () => {
    const cv = build258Cv({ summary: '' });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    const text = buildConciseGroundedSummary(factSet, 'en', 'male', duration, {
      includeSkills: true,
    });
    expect(summaryHasMalformedSkillsFragment(text)).toBe(false);
    if (/Key skills include/i.test(text)) {
      expect(text).toMatch(/Key skills include [a-z]/i);
    }
    // Leadership skill label must not become a leadership-achievement claim.
    expect(text).not.toMatch(/\bled a team\b|\bleadership of\b|\bteam leadership\b/i);
  });

  it('works with zero skills', () => {
    const cv = build258Cv({ summary: '', skills: [] });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    const text = buildConciseGroundedSummary(factSet, 'en', 'male', duration, {
      includeSkills: true,
    });
    assertThreeMaterialFacts(text, 'zero-skills');
    expect(text).not.toMatch(/Key skills include/i);
  });
});

describe('build-258 duration / tense locales', () => {
  it('current role EN duration once', () => {
    const cv = build258Cv({ summary: '', skills: [] });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    expect(duration.approxYears).toBe(1.5);
    const text = buildConciseGroundedSummary(factSet, 'en', 'male', duration, {
      includeSkills: false,
    });
    expect((text.match(/approximately one and a half years of experience/gi) || []).length).toBe(1);
  });

  it('completed role uses past-compatible prose', () => {
    const cv = build258Cv({
      summary: '',
      skills: [],
      experience: [{
        id: 'exp-1',
        company: 'Atlas',
        position: 'Custom Title XYZ-47',
        startDate: '2023-01',
        endDate: '2024-06',
        isPresent: false,
        description: FINALIZED_EXP.replace(/Reviews|Updates|Coordinates/g, (m) =>
          ({ Reviews: 'Reviewed', Updates: 'Updated', Coordinates: 'Coordinated' } as const)[m as 'Reviews'] || m),
        originalUserDescription: USER_DUTIES.join('\n'),
        canonicalDescription: USER_DUTIES.join('\n'),
        descriptionOrigin: 'user',
      }],
    });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    const text = buildConciseGroundedSummary(factSet, 'en', 'male', duration, {
      includeSkills: false,
    });
    assertThreeMaterialFacts(text, 'completed');
    expect(text).not.toMatch(/\bsince March\b/i);
  });
});
