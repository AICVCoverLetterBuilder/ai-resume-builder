import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  applyProjectionToCv,
  sealCanonicalFromValidatedSource,
} from '@/lib/cv-canonical-snapshot';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import {
  omitInvalidLocalizedFieldsForPreview,
  textMatchesRequestedFieldLocale,
  validateFinalLocalizedCvFields,
} from '@/lib/cv-field-locale-integrity';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import { validateCurrentRoleTenseMix } from '@/lib/cv-semantic-fidelity';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { finalizeClientAiSummary } from '@/lib/cv-summary-integrity';

const REF = '2026-07-15';
const SR_SUMMARY =
  'Dizajnerka enterijera sa oko pet godina profesionalnog iskustva. Kreira funkcionalna i estetski usklađena prostorna rešenja.';
const CANONICAL_BULLETS = [
  'Development and implementation of internal processes',
  'Collaboration with cross-functional teams on project execution',
  'Business-data analysis and reporting for senior management',
  'Planning and coordination of departmental activities',
].map((line) => `• ${line}`).join('\n');

function cvFixture(): CVData {
  const cv: CVData = {
    id: 'locale-integrity-1',
    name: 'Locale integrity',
    personal: {
      fullName: 'Ana Example',
      email: 'ana@example.com',
      phone: '+381',
      address: 'Belgrade',
      jobTitle: 'OPERATER U PROIZVODNJI',
      gender: 'female',
    },
    summary: 'Production operator with experience in internal processes.',
    summaryOrigin: 'ai_generated',
    experience: [{
      id: 'exp-1',
      company: 'Hilux',
      position: 'Production Operator',
      startDate: '2022-01',
      endDate: '',
      isPresent: true,
      description: CANONICAL_BULLETS,
      canonicalDescription: CANONICAL_BULLETS,
    }],
    education: [{
      id: 'edu-1',
      school: 'University of Belgrade',
      degree: 'Bachelor',
      startDate: '2017-09',
      endDate: '2021-06',
      description: '',
    }],
    skills: ['Adobe Photoshop', 'Figma', 'UI/UX', 'Communication'],
    certifications: [],
    languages: [
      { name: 'English', level: 'Advanced' },
      { name: 'Dutch', level: 'Fluent' },
    ],
    templateId: 'creative-artistic',
    region: 'Balkan',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
  return sealCanonicalFromValidatedSource(cv, {
    locale: 'en',
    createdFrom: 'user_structured_input',
    revise: false,
  });
}

describe('final per-field locale validation', () => {
  it('rejects the exact Serbian summary as mixed_locale_summary for Hindi', () => {
    expect(textMatchesRequestedFieldLocale(SR_SUMMARY, 'hi', 'summary')).toBe(false);
    const result = validateFinalLocalizedCvFields({
      ...cvFixture(),
      summary: SR_SUMMARY,
    }, 'hi');
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'mixed_locale_summary',
        path: 'summary',
      }),
    ]));
  });

  it('accepts Hindi grammar with Latin technical tokens, company and email', () => {
    const summary =
      'मैं पाँच वर्षों के अनुभव वाली इंटीरियर डिज़ाइनर हूँ और Figma, UI/UX तथा Adobe Photoshop का उपयोग करती हूँ। Hilux में डिज़ाइन टीम के साथ काम करती हूँ।';
    expect(textMatchesRequestedFieldLocale(summary, 'hi', 'summary')).toBe(true);
  });

  it('omits invalid Serbian prose from Hindi preview fields', () => {
    const preview = omitInvalidLocalizedFieldsForPreview({
      ...cvFixture(),
      summary: SR_SUMMARY,
      education: [{
        ...cvFixture().education[0],
        description: 'Pratila sam realizaciju studentskih projekata.',
      }],
    }, 'hi');
    expect(preview.summary).toBe('');
    expect(preview.education[0].description).toBe('');
  });

  it('does not activate a Serbian Stronger AI response for requested Hindi', () => {
    const cv = cvFixture();
    const resolved = finalizeClientAiSummary(
      SR_SUMMARY,
      cv,
      'hi',
      buildExperienceDurationSnapshot(cv.experience, REF),
    );
    expect(resolved.blocked).toBe(false);
    expect(resolved.summary).not.toContain('Dizajnerka enterijera');
    expect(textMatchesRequestedFieldLocale(resolved.summary, 'hi', 'summary')).toBe(true);
  });

  it('rejects false Hindi provenance and regenerates actual Hindi field text', () => {
    const source = cvFixture();
    const valid = prepareCreativeArtisticExport(source, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const tamperedProjection = {
      ...valid.projection,
      localizedSummary: SR_SUMMARY,
      localizedSummaryProvenance: {
        ...valid.projection.localizedSummaryProvenance,
        localizedLocale: 'hi' as const,
      },
    };
    const tamperedCv: CVData = {
      ...source,
      summary: SR_SUMMARY,
      localizedProjections: {
        hi: tamperedProjection,
      },
    };

    const rebuilt = prepareCreativeArtisticExport(tamperedCv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(rebuilt.cv.summary).not.toContain('Dizajnerka enterijera');
    expect(textMatchesRequestedFieldLocale(rebuilt.cv.summary, 'hi', 'summary')).toBe(true);
    expect(rebuilt.projection.localizedSummaryProvenance.localizedLocale).toBe('hi');
    expect(applyProjectionToCv(source, rebuilt.projection).summary).toBe(rebuilt.cv.summary);
  });

  it('validates every Hindi export field independently', () => {
    const prepared = prepareCreativeArtisticExport(cvFixture(), 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const check = validateFinalLocalizedCvFields(prepared.cv, 'hi');
    expect(check.valid).toBe(true);
    expect(prepared.cv.skills).toEqual(expect.arrayContaining(['UI/UX']));
    expect(prepared.cv.skills.join(' ')).toMatch(/Adobe Photoshop|एडोब फोटोशॉप/u);
    expect(prepared.cv.skills.join(' ')).toMatch(/Figma|फिग्मा/u);
    expect(prepared.cv.languages.map((language) => language.level)).toEqual([
      'उन्नत',
      'धाराप्रवाह',
    ]);
  });
});

describe('current-role Serbian tense consistency', () => {
  const mixed = [
    '• Kreirala sam koncepte enterijera.',
    '• Izrađivala sam tehničku dokumentaciju.',
    '• Sarađujem sa klijentima i izvođačima.',
    '• Pratila sam realizaciju projekta.',
  ].join('\n');

  it('detects the verified mixed past/present current role', () => {
    const violations = validateCurrentRoleTenseMix(mixed, 'sr', true);
    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'employment_tense_mismatch' }),
    ]));
  });

  it('normalizes all verified current-role verbs to present tense', () => {
    const source = cvFixture();
    const srCv: CVData = {
      ...source,
      personal: { ...source.personal, jobTitle: 'Dizajnerka enterijera' },
      summary: 'Dizajnerka enterijera sa oko pet godina iskustva.',
      experience: [{
        ...source.experience[0],
        position: 'Dizajnerka enterijera',
        description: mixed,
        canonicalDescription: mixed,
      }],
    };
    const quality = applyCvContentQuality(srCv, 'sr', {
      gender: 'female',
      referenceDate: REF,
      summaryOrigin: 'ai_generated',
    });
    const bullets = quality.cv.experience[0].description;
    expect(bullets).toContain('Kreiram');
    expect(bullets).toContain('Izrađujem');
    expect(bullets).toContain('Sarađujem');
    expect(bullets).toContain('Pratim');
    expect(bullets).not.toMatch(/Kreirala sam|Izrađivala sam|Pratila sam/);
    expect(validateCurrentRoleTenseMix(bullets, 'sr', true)).toEqual([]);
  });
});
