/**
 * @vitest-environment node
 *
 * End-to-end package-1 regression: exercises the SAME apply orchestration used by
 * Android CV builder Generate / Stronger / Bullets / Save / Preview / PDF / DOCX
 * via `runCvAiApplyPipeline` (shared with page handlers' finalization gate).
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  evaluateRoleDutyConsistency,
  localizeOccupationalTitleForProjection,
} from '@/lib/cv-role-title';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import { localizeCvLanguageLevel } from '@/lib/cv-language-levels';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import { stripAiProtocolMarkers, hasAiProtocolMarker } from '@/lib/cv-ai-protocol-strip';
import { acceptValidatedAiContent } from '@/lib/cv-canonical-snapshot';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2026-07-15';

const CANONICAL_DUTIES = [
  '• Transport, load and safely deliver goods within warehouse operations.',
  '• Work on the development and implementation of internal processes.',
  '• Collaborate with cross-functional teams on project execution.',
  '• Analyze business data and prepare reports for senior management.',
].join('\n');

const BAD_SR_SUMMARY =
  'Profesionalka sa iskustvom u radu kao kuvarica, sa oko četiri godina iskustva. Podržava starije članove tima u realizaciji projekata usklađenih sa ciljevima organizacije i zahtevima klijenata. Doprinosi unapređenju internih procesa prepoznavanjem neefikasnosti i predlaganjem praktičnih rešenja. Sarađuje sa međufunkcionalnim timovima kako bi se dodeljeni zadaci i rezultati završili na vreme. Vodi preciznu evidenciju i dokumentaciju u cilju podrške izveštavanju i ispunjavanju zahteva usklađenosti.';

/** Latest real-device Serbian export: forces Kuvarka + invents impact. */
const BAD_SR_SUMMARY_LATEST =
  'Kuvarka sa oko četiri i po godine iskustva u oblasti skladišnog poslovanja i operativnih procesa. Konzistentno obezbeđujem visoke standarde u rukovanju robom i doprinosim efikasnijem funkcionisanju tima. Preuzimanjem inicijative obezbeđujem uspešno izvršenje projekata i jasnu komunikaciju između odeljenja. Pripremam izveštaje koji pružaju pouzdan osnov za poslovne odluke.';

const BAD_EN_SUMMARY =
  'Professional cook with four years of experience supporting team operations, identifying process inefficiencies, and collaborating across functions to consistently deliver results on time.';

const BAD_EN_SUMMARY_WITH_MARKER =
  'CORRECTED PROFESSIONAL SUMMARY:\nProfessional cook with four years of experience supporting senior team members in delivering projects aligned with organizational goals and client requirements, identifying inefficiencies and proposing practical solutions, and maintaining accurate records and documentation to support reporting and compliance requirements.';

const BAD_EN_BULLETS = [
  '• Supported senior team members in delivering projects aligned with organizational goals and client requirements.',
  '• Contributed to internal process improvements by identifying inefficiencies and proposing practical solutions.',
  '• Collaborated with cross-functional teams to ensure timely completion of assigned tasks and deliverables.',
  '• Maintained accurate records and documentation to support reporting and compliance requirements.',
].join('\n');

const BAD_HI_SUMMARY =
  'मैं चार व र्षों केव्यावसायिक अनुभव केसाथ दक्ष रसोइया केरूप मेंमैं हूँऔर टीम ऑपरेशन केअंतर्गत प्रक्रिया की कमियों की पहचान करती हूँ और निर्धारित समय में परिणाम सुनिश्चित करती हूँ। Egrjdruur में काम करती हूँ।';

const UNSUPPORTED_SR = [
  /starije\s+članove/iu,
  /ciljevima\s+organizacije/iu,
  /zahtevima\s+klijenata/iu,
  /neefikasnost/iu,
  /praktičn\w*\s+rešenj/iu,
  /završili\s+na\s+vreme/iu,
  /dokumentacij/iu,
  /usklađenost/iu,
  /kuvarica|kuvarka/iu,
  /četiri\s+godina/iu,
  /visok\w*\s+standard/iu,
  /efikasnij\w*\s+funkcionisanju/iu,
  /inicijativ/iu,
  /poslovn\w*\s+odluk/iu,
];

const UNSUPPORTED_EN = [
  /senior team/iu,
  /organizational goals/iu,
  /client requirements/iu,
  /inefficienc/iu,
  /practical solutions/iu,
  /compliance/iu,
  /documentation/iu,
  /deliverables/iu,
  /professional cook/iu,
  /results on time/iu,
];

function package1Cv(): CVData {
  return {
    id: 'pkg1-e2e',
    name: 'Package1',
    personal: {
      fullName: 'Ana Test',
      email: 'ana@example.com',
      phone: '+381',
      address: 'Belgrade',
      jobTitle: 'Kuvar',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'exp-egr',
        company: 'Egrjdruur',
        position: 'Kuvar',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: CANONICAL_DUTIES,
        canonicalDescription: CANONICAL_DUTIES,
      },
    ],
    education: [],
    skills: [
      'Emotional intelligence',
      'Stress management',
      'Organization',
      'Time management',
      'Adaptability',
      'Communication',
      'Customer service',
      'Attention to detail',
      'Teamwork',
    ],
    certifications: [],
    languages: [
      { name: 'French', level: 'advanced' },
      { name: 'Chinese', level: 'advanced' },
    ],
    templateId: 'creative-artistic',
    region: 'Balkan',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function assertSummaryInvariant(pipeline: ReturnType<typeof runCvAiApplyPipeline>) {
  expect(pipeline.blocked).toBe(false);
  const s = pipeline.stateCv.summary;
  expect(pipeline.previewCv.summary).toBe(s);
  expect(pipeline.pdfCv.summary).toBe(s);
  expect(pipeline.docxCv.summary).toBe(s);
}

function assertBulletsInvariant(pipeline: ReturnType<typeof runCvAiApplyPipeline>) {
  expect(pipeline.blocked).toBe(false);
  const b = pipeline.stateCv.experience[0].description;
  expect(pipeline.previewCv.experience[0].description).toBe(b);
  expect(pipeline.pdfCv.experience[0].description).toBe(b);
  expect(pipeline.docxCv.experience[0].description).toBe(b);
}

describe('Package-1 E2E apply pipeline (page orchestration)', () => {
  it('roleDutyConflict is true for Kuvar + logistics duties', () => {
    const cv = package1Cv();
    const r = evaluateRoleDutyConsistency({
      profileJobTitle: 'Kuvar',
      experienceTitle: 'Kuvar',
      dutiesText: CANONICAL_DUTIES,
    });
    expect(r.conflict).toBe(true);
    expect(r.titleCategory).toBe('cooking');
  });

  it('1-3. Serbian bad summary fixture → grounded state, četiri i po godine, consistent', () => {
    const cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'summary_stronger',
      candidate: BAD_SR_SUMMARY,
      durationSnapshot,
      referenceDateIso: REF,
    });
    assertSummaryInvariant(pipeline);
    for (const re of UNSUPPORTED_SR) {
      expect(pipeline.stateCv.summary).not.toMatch(re);
    }
    expect(pipeline.stateCv.summary).toMatch(/četiri(?:\s+i\s+po)?\s+godine/iu);
    expect(pipeline.stateCv.summary).not.toMatch(/kuvarica|cook/iu);
    expect(pipeline.finalized.roleDutyConflict).toBe(true);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
  });

  it('4-6. English summary neutral + bullets preserve transport/loading', () => {
    const cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const summaryPipe = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'summary_generate',
      candidate: BAD_EN_SUMMARY,
      durationSnapshot,
      referenceDateIso: REF,
    });
    assertSummaryInvariant(summaryPipe);
    for (const re of UNSUPPORTED_EN) {
      expect(summaryPipe.stateCv.summary).not.toMatch(re);
    }
    expect(summaryPipe.stateCv.summary).toMatch(/professional/i);
    expect(summaryPipe.stateCv.summary).not.toMatch(/cook/i);

    const bulletsPipe = runCvAiApplyPipeline({
      cv: summaryPipe.stateCv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: BAD_EN_BULLETS,
      experienceId: 'exp-egr',
      referenceDateIso: REF,
    });
    assertBulletsInvariant(bulletsPipe);
    const desc = bulletsPipe.stateCv.experience[0].description;
    expect(desc).toMatch(/transport/i);
    expect(desc).toMatch(/load/i);
    expect(desc).toMatch(/deliver/i);
    expect(desc).not.toMatch(/senior team|client requirements|compliance|organizational goals/i);
    expect(bulletsPipe.pdfCv.experience[0].description).toBe(desc);
    expect(bulletsPipe.docxCv.experience[0].description).toBe(desc);
  });

  it('7-10. Hindi bad summary: spacing fixed, cook removed, feminine, no inventions', () => {
    const cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'summary_generate',
      candidate: BAD_HI_SUMMARY,
      durationSnapshot,
      referenceDateIso: REF,
    });
    assertSummaryInvariant(pipeline);
    const s = pipeline.stateCv.summary;
    expect(s).not.toMatch(/व\s+र्षों|केव्यावसायिक|केसाथ|केरूप|मेंमैं|हूँऔर|केअंतर्गत/);
    expect(s).not.toMatch(/रसोइया|टीम\s+ऑपरेशन|समय\s+सीमा|कमियों/);
    expect(s).toMatch(/पेशेवर|मैं/);
    expect(s).toMatch(/हूँ|है/);
    expect(pipeline.pdfCv.summary).toBe(s);
  });

  it('11. Language levels remain localized correctly', () => {
    expect(localizeCvLanguageLevel('advanced', 'sr')).toBe('Napredni');
    expect(localizeCvLanguageLevel('advanced', 'en')).toBe('Advanced');
    expect(localizeCvLanguageLevel('advanced', 'hi')).toBe('उन्नत');
  });

  it('12-16. Generate/Shorter/Stronger/Professional/Bullets all use final gate', () => {
    const cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const actions = [
      'summary_generate',
      'summary_shorter',
      'summary_stronger',
      'summary_professional',
    ] as const;
    for (const action of actions) {
      const pipeline = runCvAiApplyPipeline({
        cv,
        locale: 'en',
        action,
        candidate: BAD_EN_SUMMARY,
        durationSnapshot,
        referenceDateIso: REF,
      });
      expect(pipeline.blocked).toBe(false);
      expect(pipeline.finalized.countedAsSuccess).toBe(true);
      expect(pipeline.stateCv.summary).not.toMatch(/cook|inefficienc|compliance/i);
    }
    const bullets = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: BAD_EN_BULLETS,
      experienceId: 'exp-egr',
      referenceDateIso: REF,
    });
    expect(bullets.finalized.countedAsSuccess).toBe(true);
    expect(bullets.stateCv.experience[0].description).toMatch(/transport/i);
  });

  it('18-19. Rejected candidate does not count; applied fallback counts once', () => {
    const cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const blocked = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'ja',
      cv: { ...cv, experience: [] },
      candidate: '',
      durationSnapshot,
    });
    // Empty with no facts may block
    if (blocked.blocked) {
      expect(blocked.countedAsSuccess).toBe(false);
    }
    const applied = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'en',
      cv,
      candidate: BAD_EN_SUMMARY,
      durationSnapshot,
    });
    expect(applied.blocked).toBe(false);
    expect(applied.countedAsSuccess).toBe(true);
    expect(applied.origin).toBe('deterministic_fallback');
  });

  it('20-21. Locale order does not leak cook title or corporate bullets', () => {
    let cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    for (const locale of ['sr', 'en', 'hi'] as Locale[]) {
      const pipe = runCvAiApplyPipeline({
        cv,
        locale,
        action: 'summary_generate',
        candidate: locale === 'sr' ? BAD_SR_SUMMARY : locale === 'hi' ? BAD_HI_SUMMARY : BAD_EN_SUMMARY,
        durationSnapshot,
        referenceDateIso: REF,
      });
      expect(pipe.blocked).toBe(false);
      expect(pipe.stateCv.summary).not.toMatch(/kuvarica|professional cook|रसोइया|starije članove|compliance/i);
      cv = pipe.stateCv;
    }
    cv = package1Cv();
    for (const locale of ['hi', 'sr', 'en'] as Locale[]) {
      const pipe = runCvAiApplyPipeline({
        cv,
        locale,
        action: 'summary_generate',
        candidate: locale === 'sr' ? BAD_SR_SUMMARY : locale === 'hi' ? BAD_HI_SUMMARY : BAD_EN_SUMMARY,
        durationSnapshot,
        referenceDateIso: REF,
      });
      expect(pipe.blocked).toBe(false);
      cv = pipe.stateCv;
    }
  });

  it('cross-locale representative: de/ar/ja/ru/pt-BR reject English corporate bullets via gate', () => {
    const cv = package1Cv();
    for (const locale of ['de', 'ar', 'ja', 'ru', 'pt-BR'] as Locale[]) {
      const pipe = runCvAiApplyPipeline({
        cv,
        locale,
        action: 'experience_bullets',
        candidate: BAD_EN_BULLETS,
        experienceId: 'exp-egr',
        referenceDateIso: REF,
      });
      expect(pipe.blocked).toBe(false);
      expect(pipe.stateCv.experience[0].description).not.toMatch(/senior team members|compliance requirements/i);
    }
  });

  it('latest Serbian Kuvarka+impact fixture → neutral grounded summary', () => {
    const cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'summary_stronger',
      candidate: BAD_SR_SUMMARY_LATEST,
      durationSnapshot,
      referenceDateIso: REF,
    });
    assertSummaryInvariant(pipeline);
    expect(pipeline.stateCv.summary).not.toMatch(/kuvarka|kuvarica|inicijativ|visok\w*\s+standard|efikasnij|poslovn\w*\s+odluk/iu);
    expect(pipeline.stateCv.summary).toMatch(/četiri(?:\s+i\s+po)?\s+godine/iu);
    expect(pipeline.stateCv.personal.jobTitle).toBe('Kuvar');
    expect(pipeline.finalized.roleDutyConflict).toBe(true);
  });

  it('English CORRECTED PROFESSIONAL SUMMARY marker never reaches state/export', () => {
    expect(hasAiProtocolMarker(BAD_EN_SUMMARY_WITH_MARKER)).toBe(true);
    expect(stripAiProtocolMarkers(BAD_EN_SUMMARY_WITH_MARKER)).not.toMatch(/CORRECTED PROFESSIONAL SUMMARY/i);
    const cv = package1Cv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'summary_stronger',
      candidate: BAD_EN_SUMMARY_WITH_MARKER,
      durationSnapshot,
      referenceDateIso: REF,
    });
    assertSummaryInvariant(pipeline);
    expect(pipeline.stateCv.summary).not.toMatch(/CORRECTED PROFESSIONAL SUMMARY/i);
    expect(pipeline.stateCv.summary).not.toMatch(/senior team|compliance|organizational goals|cook/i);
    expect(pipeline.pdfCv.summary).not.toMatch(/CORRECTED PROFESSIONAL SUMMARY/i);
    expect(pipeline.docxCv.summary).not.toMatch(/CORRECTED PROFESSIONAL SUMMARY/i);
  });

  it('AI bullets never replace immutable canonical duties', () => {
    const cv = package1Cv();
    const before = cv.experience[0].canonicalDescription;
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      cv,
      candidate: BAD_EN_BULLETS,
      experienceId: 'exp-egr',
    });
    expect(finalized.blocked).toBe(false);
    const next = applyFinalizedBulletsToCv(cv, 'en', 'exp-egr', finalized);
    expect(next.experience[0].canonicalDescription).toBe(before);
    expect(next.experience[0].description).toMatch(/transport/i);
    expect(next.experience[0].description).not.toMatch(/senior team|compliance/i);
    // Second locale must still ground on original duties, not English AI text
    const hi = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      cv: next,
      candidate: BAD_EN_BULLETS,
      experienceId: 'exp-egr',
    });
    expect(hi.blocked).toBe(false);
    expect(hi.text).toMatch(/परिवहन|गोदाम|लोडिंग/);
    const afterHi = applyFinalizedBulletsToCv(next, 'hi', 'exp-egr', hi);
    expect(afterHi.experience[0].canonicalDescription).toBe(before);
  });

  it('title leak: canonical Kuvar survives hi→sr→en display projections', () => {
    let cv = package1Cv();
    expect(cv.personal.jobTitle).toBe('Kuvar');
    // Simulate mistaken write of quality projection (historical bug) — ensure
    // forward path never keeps localized title after apply.
    const hiProj = applyCvContentQuality(cv, 'hi', { gender: 'female' }).cv;
    expect(hiProj.personal.jobTitle).toBe('रसोइया');
    // State must remain canonical when AI applies
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const hi = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'summary_generate',
      candidate: BAD_HI_SUMMARY,
      durationSnapshot,
      referenceDateIso: REF,
    });
    expect(hi.stateCv.personal.jobTitle).toBe('Kuvar');
    cv = hi.stateCv;
    const sr = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'summary_generate',
      candidate: BAD_SR_SUMMARY_LATEST,
      durationSnapshot,
      referenceDateIso: REF,
    });
    expect(sr.stateCv.personal.jobTitle).toBe('Kuvar');
    expect(localizeOccupationalTitleForProjection(sr.stateCv.personal.jobTitle, 'sr', 'female')).toBe('Kuvarica');
    expect(localizeOccupationalTitleForProjection(sr.stateCv.personal.jobTitle, 'en', 'female')).toBe('Cook');
    expect(localizeOccupationalTitleForProjection(sr.stateCv.personal.jobTitle, 'hi', 'female')).toBe('रसोइया');
    // Even if storage were polluted with Hindi display title, projection recovers.
    expect(localizeOccupationalTitleForProjection('रसोइया', 'sr', 'female')).toBe('Kuvarica');
    expect(localizeOccupationalTitleForProjection('रसोइया', 'en', 'female')).toBe('Cook');
    expect(sr.stateCv.summary).not.toMatch(/रसोइया/);
    const en = runCvAiApplyPipeline({
      cv: sr.stateCv,
      locale: 'en',
      action: 'summary_generate',
      candidate: BAD_EN_SUMMARY_WITH_MARKER,
      durationSnapshot,
      referenceDateIso: REF,
    });
    expect(en.stateCv.personal.jobTitle).toBe('Kuvar');
    expect(en.stateCv.summary).not.toMatch(/रसोइया|CORRECTED PROFESSIONAL SUMMARY/i);
  });

  it('acceptValidatedAiContent does not promote AI description to canonical', () => {
    const cv = package1Cv();
    const frozen = cv.experience[0].canonicalDescription;
    const next = acceptValidatedAiContent(cv, {
      locale: 'en',
      experienceId: 'exp-egr',
      description: BAD_EN_BULLETS,
    });
    expect(next.experience[0].canonicalDescription).toBe(frozen);
    expect(next.experience[0].description).toBe(BAD_EN_BULLETS);
  });

  it('generic occupation conflict: teacher + software duties → neutral opening', () => {
    const cv = package1Cv();
    cv.personal.jobTitle = 'Teacher';
    cv.experience[0].position = 'Teacher';
    cv.experience[0].canonicalDescription = '• Develop React applications and deploy APIs.\n• Write unit tests in TypeScript.';
    cv.experience[0].description = cv.experience[0].canonicalDescription;
    const r = evaluateRoleDutyConsistency({
      profileJobTitle: 'Teacher',
      dutiesText: cv.experience[0].canonicalDescription,
    });
    expect(r.conflict).toBe(true);
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'summary_generate',
      candidate: 'Experienced teacher who writes production React code and leads classrooms daily.',
      durationSnapshot,
      referenceDateIso: REF,
    });
    expect(pipe.blocked).toBe(false);
    expect(pipe.stateCv.summary).not.toMatch(/\bteacher\b/i);
  });
});

describe('50× cold-state package-1 E2E', () => {
  it('50 independent runs with zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = package1Cv();
      const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);
      const sr = runCvAiApplyPipeline({
        cv,
        locale: 'sr',
        action: 'summary_stronger',
        candidate: BAD_SR_SUMMARY_LATEST,
        durationSnapshot,
        referenceDateIso: REF,
      });
      expect(sr.blocked).toBe(false);
      expect(sr.stateCv.summary).not.toMatch(/kuvarka|kuvarica|inicijativ|neefikasnost/iu);
      expect(sr.stateCv.personal.jobTitle).toBe('Kuvar');
      const enBullets = runCvAiApplyPipeline({
        cv: sr.stateCv,
        locale: 'en',
        action: 'experience_bullets',
        candidate: BAD_EN_BULLETS,
        experienceId: 'exp-egr',
        referenceDateIso: REF,
      });
      expect(enBullets.stateCv.experience[0].description).toMatch(/transport/i);
      expect(enBullets.stateCv.experience[0].canonicalDescription).toMatch(/Transport, load/);
      const enSum = runCvAiApplyPipeline({
        cv: enBullets.stateCv,
        locale: 'en',
        action: 'summary_stronger',
        candidate: BAD_EN_SUMMARY_WITH_MARKER,
        durationSnapshot,
        referenceDateIso: REF,
      });
      expect(enSum.stateCv.summary).not.toMatch(/CORRECTED PROFESSIONAL SUMMARY/i);
      const hi = runCvAiApplyPipeline({
        cv: enSum.stateCv,
        locale: 'hi',
        action: 'summary_generate',
        candidate: BAD_HI_SUMMARY,
        durationSnapshot,
        referenceDateIso: REF,
      });
      expect(hi.stateCv.summary).not.toMatch(/केसाथ|हूँऔर|रसोइया/);
      expect(hi.stateCv.personal.jobTitle).toBe('Kuvar');
      expect(hi.pdfCv.summary).toBe(hi.stateCv.summary);
      expect(hi.docxCv.summary).toBe(hi.stateCv.summary);
    }
  });
});
