import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  applyApproximateDurationPolicy,
  buildExperienceDurationSnapshot,
  computeExperienceDuration,
  extractSummaryYearClaims,
  monthsBetweenYearMonths,
  validateSummaryDuration,
} from '@/lib/cv-experience-duration';
import {
  applyCvContentQuality,
  classifyContactCenterMeaning,
  resolveSummaryWithDurationPolicy,
} from '@/lib/cv-content-quality';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { prepareCorporateNavyExport } from '@/lib/corporate-navy-export-integrity';
import { applyCanonicalSummaryEdit, sealCanonicalFromValidatedSource } from '@/lib/cv-canonical-snapshot';

const REF = '2026-07-15';

const EN_BULLETS = [
  'Answer customer inquiries via phone and provide accurate, timely information about services.',
  'Resolve customer complaints and issues according to internal procedures and quality standards.',
  'Collaborate with other teams to escalate and resolve customer requests effectively.',
  'Maintain records of conversations and enter relevant data into the customer tracking system.',
].map((b) => `• ${b}`).join('\n');

function baseCv(overrides?: Partial<CVData>): CVData {
  const cv: CVData = {
    id: 'cv-duration-1',
    name: 'Test',
    personal: {
      fullName: 'Ana Jovanović',
      email: 'ana@example.com',
      phone: '+381',
      address: 'Belgrade',
      jobTitle: 'Customer Service Specialist',
      gender: 'female',
    },
    summary:
      'Customer Service Specialist with around four years of experience. Handles phone inquiries and customer complaints.',
    experience: [
      {
        id: 'exp-1',
        company: 'Support Co',
        position: 'Customer Service Specialist',
        startDate: '2021-05',
        endDate: '',
        isPresent: true,
        description: EN_BULLETS,
        canonicalDescription: EN_BULLETS,
      },
    ],
    education: [],
    skills: ['Communication'],
    certifications: [],
    languages: [{ name: 'English', level: 'Advanced' }],
    templateId: 'creative-artistic',
    region: 'Balkan',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
  return sealCanonicalFromValidatedSource(cv, {
    locale: 'en',
    createdFrom: 'user_structured_input',
    revise: false,
  });
}

describe('deterministic experience duration (2021-05 current → Jul 2026)', () => {
  it('computes 62 months / five approx years for the verified case', () => {
    expect(monthsBetweenYearMonths('2021-05', '2026-07')).toBe(62);
    const d = computeExperienceDuration(
      { startDate: '2021-05', endDate: '', isPresent: true },
      REF,
    );
    expect(d.totalMonths).toBe(62);
    expect(d.fullYears).toBe(5);
    expect(d.remainingMonths).toBe(2);
    expect(d.approxYears).toBe(5);
    expect(d.unit).toBe('years');
  });

  it('applies shared approximate policy buckets', () => {
    expect(applyApproximateDurationPolicy(8).unit).toBe('months');
    expect(applyApproximateDurationPolicy(14).approxYears).toBe(1);
    expect(applyApproximateDurationPolicy(20).approxYears).toBe(2);
    expect(applyApproximateDurationPolicy(59).approxYears).toBe(4);
    expect(applyApproximateDurationPolicy(62).approxYears).toBe(5);
  });

  it('does not invent duration for missing dates', () => {
    const d = computeExperienceDuration(
      { startDate: '', endDate: '', isPresent: true },
      REF,
    );
    expect(d.hasValidDates).toBe(false);
    expect(d.totalMonths).toBe(0);
  });
});

describe('duration validation and recovery', () => {
  it('rejects four-year claims when expected is five', () => {
    const expected = applyApproximateDurationPolicy(62);
    const en = validateSummaryDuration(
      'Specialist with around four years of experience.',
      expected,
    );
    expect(en.valid).toBe(false);
    expect(en.violation).toBe('experience_duration_mismatch');
    expect(extractSummaryYearClaims('around four years')).toEqual([4]);
  });

  it('repairs mismatched summaries to the shared duration', () => {
    const expected = applyApproximateDurationPolicy(62);
    const repaired = resolveSummaryWithDurationPolicy(
      'Customer Service Specialist with around four years of experience. Supports clients.',
      expected,
      'en',
    );
    expect(repaired.status).not.toBe('passed');
    expect(validateSummaryDuration(repaired.summary, expected).valid).toBe(true);
    expect(repaired.summary.toLowerCase()).toMatch(/five|5/);
    expect(repaired.summary.toLowerCase()).not.toMatch(/four/);
  });

  it('does not force a duration claim into a custom summary without one', () => {
    const expected = applyApproximateDurationPolicy(62);
    const custom = 'Dedicated specialist focused on clear communication and careful follow-up.';
    const check = validateSummaryDuration(custom, expected);
    expect(check.valid).toBe(true);
    expect(check.claims).toEqual([]);

    const cv = baseCv({
      summary: custom,
      summaryOrigin: 'user',
    });
    const q = applyCvContentQuality(cv, 'en', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'user',
    });
    expect(q.cv.summary).toBe(custom);
    expect(q.cv.summary.toLowerCase()).not.toMatch(/five|years of experience/);
  });

  it('requires duration on AI-generated summaries that omit it', () => {
    const expected = applyApproximateDurationPolicy(62);
    const omitted = 'Customer Service Specialist working since May 2021. Supports clients by phone.';
    expect(validateSummaryDuration(omitted, expected).valid).toBe(true);
    expect(
      validateSummaryDuration(omitted, expected, { requireDurationClaim: true }).valid,
    ).toBe(false);
  });
});

describe('EN/SR/HI residual AI duration + fluff', () => {
  it('injects shared five-year duration into Serbian AI summaries that omit it', () => {
    const cv = baseCv({
      summaryOrigin: 'ai_generated',
      summary:
        'Profesionalka u radu kao agent call centra od maja 2021. Pruža podršku klijentima putem telefona.',
    });
    const q = applyCvContentQuality(cv, 'sr', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'ai_generated',
    });
    expect(q.durationSnapshot.total.totalMonths).toBe(62);
    expect(q.cv.summary.toLowerCase()).toMatch(/oko pet godina/);
    expect(q.violations).not.toContain('experience_duration_mismatch');
    expect(q.cv.summaryOrigin === 'ai_repaired' || q.cv.summaryOrigin === 'ai_generated').toBe(true);
  });

  it('injects shared five-year duration into Hindi AI summaries that omit it', () => {
    const cv = baseCv({
      summaryOrigin: 'ai_generated',
      summary: 'मई 2021 से कॉल सेंटर एजेंट के रूप में कार्यरत हूँ। ग्राहकों की मदद करती हूँ।',
    });
    const q = applyCvContentQuality(cv, 'hi', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'ai_generated',
    });
    expect(q.durationSnapshot.total.approxYears).toBe(5);
    expect(q.cv.summary).toMatch(/पाँच|पांच|5/);
    expect(q.cv.summary).toMatch(/वर्ष/);
    expect(q.violations).not.toContain('experience_duration_mismatch');
  });

  it('strips Serbian unnatural enrichment fluff from summaries', () => {
    const cv = baseCv({
      summaryOrigin: 'ai_generated',
      summary:
        'Profesionalka sa oko pet godina iskustva u oblasti korisničke podrške. Izrada izveštaja dodatno je obogaćuje kao profesionalku u oblasti korisničke podrške.',
    });
    const q = applyCvContentQuality(cv, 'sr', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'ai_generated',
    });
    expect(q.cv.summary.toLowerCase()).not.toMatch(/obogaćuje/);
    expect(q.cv.summary.toLowerCase()).not.toMatch(/izrada izveštaja dodatno/);
    expect(q.cv.summary.toLowerCase()).toMatch(/oko pet godina/);
  });

  it('strips Hindi unsupported customer-satisfaction guarantee', () => {
    const cv = baseCv({
      summaryOrigin: 'ai_generated',
      summary:
        'लगभग पाँच वर्षों के अनुभव के साथ कॉल सेंटर एजेंट हूँ, जिससे ग्राहक संतुष्टि सुनिश्चित होती है।',
    });
    const q = applyCvContentQuality(cv, 'hi', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'ai_generated',
    });
    expect(q.cv.summary).not.toMatch(/संतुष्टि सुनिश्चित/);
    expect(q.cv.summary).toMatch(/पाँच|पांच/);
  });

  it('marks manual summary edits as user origin and does not inject duration', () => {
    let cv = baseCv({ summaryOrigin: 'ai_generated' });
    cv = applyCanonicalSummaryEdit(
      cv,
      'Ručno napisan rezime bez trajanja. Fokus na jasnu komunikaciju.',
      'sr',
    );
    expect(cv.summaryOrigin).toBe('user');
    const q = applyCvContentQuality(cv, 'sr', { referenceDate: REF, gender: 'female' });
    expect(q.cv.summary.toLowerCase()).not.toMatch(/oko pet godina/);
    expect(q.cv.summary).toContain('Ručno napisan');
  });
});

describe('EN/SR/HI verified content quality', () => {
  it('English summary uses approximately five years, never four', () => {
    const cv = baseCv();
    const q = applyCvContentQuality(cv, 'en', { referenceDate: REF, gender: 'female' });
    expect(q.durationSnapshot.total.approxYears).toBe(5);
    expect(q.cv.summary.toLowerCase()).toMatch(/five|5/);
    expect(q.cv.summary.toLowerCase()).not.toMatch(/four/);
    expect(q.violations).not.toContain('experience_duration_mismatch');
  });

  it('Serbian uses oko pet godina, present-tense bullets, female-safe summary path', () => {
    const cv = baseCv({
      summary: 'Specijalista za korisničku podršku sa oko četiri godine iskustva. Podržava klijente.',
      experience: [
        {
          id: 'exp-1',
          company: 'Support Co',
          position: 'Specijalista za korisničku podršku',
          startDate: '2021-05',
          endDate: '',
          isPresent: true,
          description: [
            '• Odgovarala sam na upite klijenata putem telefona i pružala tačne informacije o uslugama.',
            '• Rešavala sam reklamacije i žalbe klijenata uz poštovanje internih procedura.',
            '• Sarađivala sam sa drugim timovima kako bi zahtevi klijenata bili rešeni.',
            '• Vodila sam evidenciju o obavljenim razgovorima i unosila podatke u sistem.',
          ].join('\n'),
          canonicalDescription: EN_BULLETS,
        },
      ],
    });
    const q = applyCvContentQuality(cv, 'sr', { referenceDate: REF, gender: 'female' });
    expect(q.durationSnapshot.total.totalMonths).toBe(62);
    expect(q.cv.summary.toLowerCase()).toMatch(/oko pet godina/);
    expect(q.cv.summary.toLowerCase()).not.toMatch(/četiri|cetiri/);
    const joined = q.cv.experience[0].description;
    expect(joined).toMatch(/Odgovaram/);
    expect(joined).toMatch(/Rešavam/);
    expect(joined).toMatch(/Sarađujem/);
    expect(joined).toMatch(/Vodim/);
    expect(joined).not.toMatch(/Odgovarala sam|Rešavala sam|Vodila sam/);
  });

  it('Hindi uses ~five years, no रिक्लेमेशन, present habitual female forms', () => {
    const cv = baseCv({
      summary: 'ग्राहक सेवा विशेषज्ञ लगभग चार वर्षों के अनुभव के साथ। ग्राहकों की मदद करती हूँ।',
      experience: [
        {
          id: 'exp-1',
          company: 'Support Co',
          position: 'ग्राहक सेवा विशेषज्ञ',
          startDate: '2021-05',
          endDate: '',
          isPresent: true,
          description: [
            '• फ़ोन के माध्यम से ग्राहकों के प्रश्नों का उत्तर देती थी और सेवाओं के बारे में जानकारी प्रदान करती थी।',
            '• ग्राहकों की शिकायतों और रिक्लेमेशन का समाधान आंतरिक प्रक्रियाओं के अनुसार करती थी।',
            '• अन्य टीमों के साथ सहयोग करती थी।',
            '• वार्तालापों का रिकॉर्ड रखती थी और डेटा दर्ज करती थी।',
          ].join('\n'),
          canonicalDescription: EN_BULLETS,
        },
      ],
    });
    const q = applyCvContentQuality(cv, 'hi', { referenceDate: REF, gender: 'female' });
    expect(q.durationSnapshot.total.approxYears).toBe(5);
    expect(q.cv.summary).toMatch(/पाँच|पांच|5/);
    expect(q.cv.summary).not.toMatch(/चार/);
    expect(q.cv.summary.length).toBeGreaterThan(40);
    const joined = q.cv.experience[0].description;
    expect(joined).not.toMatch(/रिक्लेमेशन/);
    expect(joined).toMatch(/शिकायतों और समस्याओं/);
    expect(joined).not.toMatch(/देती थी|करती थी|रखती थी|दर्ज करती थी/);
    expect(joined).toMatch(/देती हूँ|करती हूँ|रखती हूँ/);
  });

  it('classifies the four contact-center meanings from English source', () => {
    expect(classifyContactCenterMeaning(EN_BULLETS.split('\n')[0])).toBe('phone_inquiries');
    expect(classifyContactCenterMeaning(EN_BULLETS.split('\n')[1])).toBe('complaint_issue_resolution');
    expect(classifyContactCenterMeaning(EN_BULLETS.split('\n')[2])).toBe('cross_team_coordination');
    expect(classifyContactCenterMeaning(EN_BULLETS.split('\n')[3])).toBe('interaction_logging');
  });

  it('cross-locale PDF/DOCX prep share the same totalMonths and duration snapshot', () => {
    const cv = baseCv();
    const en = prepareCreativeArtisticExport(cv, 'en', { gender: 'female', referenceDate: REF });
    const sr = prepareCreativeArtisticExport(cv, 'sr', { gender: 'female', referenceDate: REF });
    const hi = prepareCreativeArtisticExport(cv, 'hi', { gender: 'female', referenceDate: REF });
    const months = [
      en.projection.experienceDurationSnapshot?.total.totalMonths,
      sr.projection.experienceDurationSnapshot?.total.totalMonths,
      hi.projection.experienceDurationSnapshot?.total.totalMonths,
    ];
    expect(months.every((m) => m === 62)).toBe(true);
    expect(en.projection.experienceDurationSnapshot).toEqual(sr.projection.experienceDurationSnapshot);
    expect(sr.projection.experienceDurationSnapshot).toEqual(hi.projection.experienceDurationSnapshot);

    // Same prep options → identical duration for a second export (DOCX parity).
    const enDocx = prepareCreativeArtisticExport(cv, 'en', { gender: 'female', referenceDate: REF });
    expect(enDocx.projection.experienceDurationSnapshot).toEqual(en.projection.experienceDurationSnapshot);

    const cnPdf = prepareCorporateNavyExport(cv, 'en', { gender: 'female', referenceDate: REF });
    const cnDocx = prepareCorporateNavyExport(cv, 'en', { gender: 'female', referenceDate: REF });
    expect(cnPdf.projection.experienceDurationSnapshot?.total.totalMonths).toBe(62);
    expect(cnPdf.projection.experienceDurationSnapshot).toEqual(cnDocx.projection.experienceDurationSnapshot);
  });

  it('locale switch does not recalculate duration from localized summary text', () => {
    const cv = baseCv({
      summary: 'Expert with around ninety-nine years of experience in storytelling.',
    });
    const snap = buildExperienceDurationSnapshot(cv.experience, REF);
    const q = applyCvContentQuality(cv, 'en', {
      gender: 'female',
      durationSnapshot: snap,
    });
    // Duration remains 62 months from dates — not 99 from the (invalid) text.
    expect(q.durationSnapshot.total.totalMonths).toBe(62);
    expect(q.cv.summary.toLowerCase()).not.toMatch(/ninety-nine|99/);
    expect(q.cv.summary.toLowerCase()).toMatch(/five|5/);
  });

  it('past roles keep past-tense Serbian/Hindi style', () => {
    const cv = baseCv({
      experience: [
        {
          id: 'exp-past',
          company: 'Old Co',
          position: 'Agent',
          startDate: '2018-01',
          endDate: '2019-06',
          isPresent: false,
          description: '• x',
          canonicalDescription: EN_BULLETS,
        },
      ],
    });
    const sr = applyCvContentQuality(cv, 'sr', { referenceDate: REF, gender: 'female' });
    expect(sr.cv.experience[0].description).toMatch(/Odgovarala sam|Rešavala sam/);
    const hi = applyCvContentQuality(cv, 'hi', { referenceDate: REF, gender: 'female' });
    expect(hi.cv.experience[0].description).toMatch(/देती थी|करती थी/);
  });

  it('roles shorter than one year use months policy', () => {
    const d = computeExperienceDuration(
      { startDate: '2026-01', endDate: '', isPresent: true },
      REF,
    );
    expect(d.unit).toBe('months');
    expect(d.totalMonths).toBe(6);
  });
});
