/**
 * @vitest-environment jsdom
 *
 * Corporate Navy EN/SR/HI male security-officer locale integrity.
 */
import { describe, expect, test, vi } from 'vitest';
import JSZip from 'jszip';
import {
  classifySecurityDutyCategory,
  CorporateNavyLocaleExportError,
  prepareCorporateNavyExport,
  textMatchesRequestedLocale,
} from '@/lib/corporate-navy-export-integrity';
import {
  formatCorporateNavySectionHeading,
  hasBrokenDevanagariLetterSpacing,
} from '@/lib/corporate-navy-heading';
import { localizeCvLanguageLevel } from '@/lib/cv-language-levels';
import { translations } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';

function hasSerbianLatin(text: string): boolean {
  return /[čćžšđ]/iu.test(text)
    || /\b(nadgledao|reagovao|obavljao|vodio|prostorij|pristupn|bezbednos)/iu.test(text);
}

const EN_BULLETS = [
  'Monitored premises and access points to prevent unauthorized entry.',
  'Responded to incidents and emergencies according to security protocols.',
  'Conducted regular patrols and inspections to uphold security standards.',
  'Maintained incident logs and reported clearly to security management.',
];

const SR_BULLETS = [
  'Nadgledao sam prostorije i pristupne tačke radi sprečavanja neovlašćenog pristupa.',
  'Reagovao sam na incidente i hitne situacije u skladu sa bezbednosnim protokolima.',
  'Obavljao sam redovne obilaske i inspekcije radi poštovanja standarda bezbednosti.',
  'Vodio sam evidenciju o incidentima i izveštavao bezbednosni menadžment.',
];

const HI_SUMMARY =
  'अनुभवी सुरक्षा अधिकारी जो परिसर निगरानी, घटना प्रतिक्रिया, गश्त और रिपोर्टिंग में दक्ष हैं।';

function securityCv(overrides: Partial<CVData> = {}): CVData {
  const base: CVData = {
    id: 'cn-security',
    name: 'Marko',
    personal: {
      fullName: 'Marko Jovanović',
      email: 'm@example.com',
      phone: '+381',
      address: 'Belgrade',
      jobTitle: 'Security Officer',
      gender: 'male',
      photoEnabled: false,
    },
    summary:
      'Experienced security officer skilled in premises monitoring, incident response, patrols, and reporting.',
    experience: [{
      id: 'exp0',
      company: 'SecureCo',
      position: 'Security Officer',
      startDate: '2022-01',
      endDate: '',
      isPresent: true,
      description: EN_BULLETS.map((b) => `- ${b}`).join('\n'),
      canonicalDescription: EN_BULLETS.map((b) => `- ${b}`).join('\n'),
    }],
    education: [{
      id: 'edu0',
      school: 'Security Academy',
      degree: 'Certificate',
      startDate: '2021',
      endDate: '2021',
      description: '',
    }],
    skills: ['Surveillance', 'Reporting'],
    certifications: [],
    languages: [{ name: 'English', level: 'Advanced' }],
    templateId: 'corporate-navy',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
  return {
    ...base,
    ...overrides,
    personal: { ...base.personal, ...(overrides.personal || {}) },
    experience: overrides.experience || base.experience,
    languages: overrides.languages || base.languages,
  };
}

describe('Corporate Navy heading shaping', () => {
  test('Devanagari headings are not letter-spaced and keep grapheme clusters', () => {
    const labels = [
      translations.hi.cv.summary,
      translations.hi.cv.experience,
      translations.hi.cv.education,
      translations.hi.cv.skills,
      translations.hi.cv.languages,
    ];
    for (const label of labels) {
      const formatted = formatCorporateNavySectionHeading(label, { letterSpaced: true });
      expect(hasBrokenDevanagariLetterSpacing(formatted)).toBe(false);
      expect(formatted).toBe(label);
      // Word spaces are fine; per-code-point letter spacing is not.
      expect(formatted).not.toMatch(/[\u0900-\u097F]\s+[\u093A-\u094D]/u);
    }
    expect(formatCorporateNavySectionHeading('पेशेवर सारांश')).toBe('पेशेवर सारांश');
    expect(formatCorporateNavySectionHeading('कार्य अनुभव')).toBe('कार्य अनुभव');
  });

  test('Latin headings retain spaced uppercase for DOCX', () => {
    expect(formatCorporateNavySectionHeading('Professional Summary', { letterSpaced: true }))
      .toBe('P R O F E S S I O N A L   S U M M A R Y');
    expect(formatCorporateNavySectionHeading('Professional Summary', { letterSpaced: false }))
      .toBe('PROFESSIONAL SUMMARY');
  });
});

describe('Corporate Navy per-field locale integrity', () => {
  test('security fact categories classify EN/SR identically by meaning', () => {
    expect(EN_BULLETS.map(classifySecurityDutyCategory)).toEqual([
      'premises_access_monitoring',
      'incident_emergency_response',
      'patrols_inspections',
      'incident_logs_reporting',
    ]);
    expect(SR_BULLETS.map(classifySecurityDutyCategory)).toEqual([
      'premises_access_monitoring',
      'incident_emergency_response',
      'patrols_inspections',
      'incident_logs_reporting',
    ]);
  });

  test('Hindi summary + Serbian bullets is repaired to Hindi-only or rejected', () => {
    const cv = securityCv({
      summary: HI_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'SecureCo',
        position: 'Security Officer',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
        canonicalDescription: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
      }],
    });
    const { cv: safe, projection } = prepareCorporateNavyExport(cv, 'hi', { gender: 'male' });
    expect(textMatchesRequestedLocale(safe.summary, 'hi')).toBe(true);
    for (const line of safe.experience[0].description.split('\n')) {
      const text = line.replace(/^[-•*]\s*/, '');
      expect(textMatchesRequestedLocale(text, 'hi')).toBe(true);
      expect(hasSerbianLatin(text)).toBe(false);
    }
    expect(projection.requestedLocale).toBe('hi');
    expect(projection.localizedExperiences[0].bullets).toHaveLength(4);
    for (const b of projection.localizedExperiences[0].bullets) {
      expect(b.provenance.localizedLocale).toBe('hi');
      expect(hasSerbianLatin(b.localizedText)).toBe(false);
      expect(/[\u0900-\u097F]/.test(b.localizedText)).toBe(true);
    }
  });

  test('every Hindi fact is validated independently (mixed generic Serbian rejects)', () => {
    const cv = securityCv({
      summary: HI_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'SecureCo',
        position: 'Security Officer',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: '- Radio sam jedinstveni kvantni kalibrator bez kategorije.\n- Još jedan srpski red bez bezbednosne kategorije.',
        canonicalDescription: '- Radio sam jedinstveni kvantni kalibrator bez kategorije.\n- Još jedan srpski red bez bezbednosne kategorije.',
      }],
    });
    expect(() => prepareCorporateNavyExport(cv, 'hi', { gender: 'male' }))
      .toThrow(CorporateNavyLocaleExportError);
    expect(() => prepareCorporateNavyExport(cv, 'hi', { gender: 'male' }))
      .toThrow(/mixed_locale_projection/);
  });

  test('English and Serbian male facts remain unchanged across prepares', () => {
    const en = securityCv();
    const enOut = prepareCorporateNavyExport(en, 'en', { gender: 'male' });
    expect(enOut.cv.experience[0].description).toContain('Monitored premises');
    expect(enOut.projection.localizedExperiences[0].bullets.map((b) => b.factId)).toEqual([
      'experience-0-bullet-0',
      'experience-0-bullet-1',
      'experience-0-bullet-2',
      'experience-0-bullet-3',
    ]);

    const sr = securityCv({
      summary: 'Iskusan službenik obezbeđenja sa iskustvom u nadzoru objekata, reagovanju na incidente, obilascima i izveštavanju.',
      experience: [{
        id: 'exp0',
        company: 'SecureCo',
        position: 'Službenik obezbeđenja',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
        canonicalDescription: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
      }],
    });
    const srOut = prepareCorporateNavyExport(sr, 'sr', { gender: 'male' });
    expect(srOut.cv.experience[0].description).toContain('Nadgledao sam');
    expect(srOut.cv.experience[0].description).not.toContain('Nadgledala sam');
    expect(srOut.projection.localizedExperiences[0].bullets.map((b) => b.semanticCategory)).toEqual([
      'premises_access_monitoring',
      'incident_emergency_response',
      'patrols_inspections',
      'incident_logs_reporting',
    ]);
  });

  test('language levels localize for EN/SR/HI', () => {
    expect(localizeCvLanguageLevel('Advanced', 'en')).toBe('Advanced');
    expect(localizeCvLanguageLevel('Advanced', 'sr')).toBe('Napredni');
    expect(localizeCvLanguageLevel('Advanced', 'hi')).toBe('उन्नत');
    const hi = prepareCorporateNavyExport(securityCv({
      summary: HI_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'SecureCo',
        position: 'Security Officer',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: EN_BULLETS.map((b) => `- ${b}`).join('\n'),
        canonicalDescription: EN_BULLETS.map((b) => `- ${b}`).join('\n'),
      }],
      languages: [{ name: 'English', level: 'Advanced' }],
    }), 'hi', { gender: 'male' });
    expect(hi.projection.localizedLanguageLevels[0].level).toBe('उन्नत');
    const sr = prepareCorporateNavyExport(securityCv({
      languages: [{ name: 'English', level: 'Advanced' }],
    }), 'sr', { gender: 'male' });
    expect(sr.projection.localizedLanguageLevels[0].level).toBe('Napredni');
  });

  test('PDF and DOCX consume the same projection id/fact texts/levels', () => {
    const cv = securityCv({
      summary: HI_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'SecureCo',
        position: 'Security Officer',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
        canonicalDescription: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
      }],
      languages: [{ name: 'English', level: 'Advanced' }],
    });
    const a = prepareCorporateNavyExport(cv, 'hi', { gender: 'male' });
    const b = prepareCorporateNavyExport(cv, 'hi', { gender: 'male' });
    expect(a.projection.projectionId).toBe(b.projection.projectionId);
    expect(a.projection.requestedLocale).toBe('hi');
    expect(a.projection.localizedExperiences[0].bullets.map((x) => x.factId))
      .toEqual(b.projection.localizedExperiences[0].bullets.map((x) => x.factId));
    expect(a.projection.localizedExperiences[0].bullets.map((x) => x.localizedText))
      .toEqual(b.projection.localizedExperiences[0].bullets.map((x) => x.localizedText));
    expect(a.projection.localizedLanguageLevels).toEqual(b.projection.localizedLanguageLevels);
  });
});

describe('Corporate Navy Hindi DOCX export has no Serbian bullets / broken headings', () => {
  test('DOCX export is Hindi-only for bullets and keeps intact Devanagari headings', async () => {
    const { exportToDOCX } = await import('@/lib/export');
    const cv = securityCv({
      summary: HI_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'SecureCo',
        position: 'Security Officer',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
        canonicalDescription: SR_BULLETS.map((b) => `- ${b}`).join('\n'),
      }],
      languages: [{ name: 'English', level: 'Advanced' }],
    });

    let savedBlob: Blob | undefined;
    Object.defineProperty(URL, 'createObjectURL', {
      value: (b: Blob) => { savedBlob = b; return 'blob:cn'; },
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true });
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag.toLowerCase() === 'a') el.click = () => {};
      return el;
    });

    await exportToDOCX(cv, 'cn-hi', 'hi', 'corporate-navy');
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const xml = (await zip.file('word/document.xml')!.async('text')).toLowerCase();

    expect(xml).toContain('परिसर');
    expect(xml).not.toContain('nadgledao');
    expect(xml).not.toContain('reagovao');
    expect(xml).not.toContain('advanced');
    expect(xml).toContain('उन्नत'.toLowerCase());
    // Headings must not be per-code-point spaced
    const rawXml = await zip.file('word/document.xml')!.async('text');
    expect(hasBrokenDevanagariLetterSpacing(rawXml)).toBe(false);
    expect(rawXml).toContain(translations.hi.cv.summary);
    expect(rawXml).toContain(translations.hi.cv.experience);

    spy.mockRestore();
  });
});
