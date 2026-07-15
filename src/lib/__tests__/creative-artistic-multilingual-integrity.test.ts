/**
 * @vitest-environment jsdom
 *
 * Creative Artistic CV: canonical fact lock, semantic fidelity, gender,
 * proficiency localization, Arabic DOCX RTL, PDF/DOCX parity, pagination.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import JSZip from 'jszip';
import {
  buildCvCanonicalFactSet,
  bulletsForExperience,
  deterministicBulletsFromCanonical,
  formatExperienceBullets,
  splitExperienceBullets,
} from '@/lib/cv-canonical-facts';
import {
  activateCvExperienceBullets,
  activateCvSummary,
  deterministicSummaryFromCanonical,
} from '@/lib/cv-content-activation';
import { localizeCvLanguageLevel } from '@/lib/cv-language-levels';
import { getLocalizedCvSkillName } from '@/lib/cv-skill-options';
import {
  validateLocalizedExperienceBullets,
  validateLocalizedSummary,
  validateSummaryCompleteness,
} from '@/lib/cv-semantic-fidelity';
import { generateBulletsOffline } from '@/lib/ai-bullets';
import { createCreativeArtisticPdfTemplate } from '@/lib/creative-artistic-pdf-template';
import { translations, type Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';

const LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

const CANONICAL_BULLETS = [
  'Prepared and served cocktails and non-alcoholic drinks according to bar recipes.',
  'Welcomed guests at the bar and took orders accurately.',
  'Maintained mise en place and bar cleanliness during service.',
  'Followed hygiene and service standards set by the venue.',
];

function bartenderCv(overrides: Partial<CVData> = {}): CVData {
  const base: CVData = {
    id: 'ca-integrity',
    name: 'Ana Markovic',
    personal: {
      fullName: 'Ana Markovic',
      email: 'ana@example.com',
      phone: '+381 60 123 4567',
      address: 'Belgrade',
      jobTitle: 'Bartender',
      photoEnabled: false,
    },
    summary:
      'Bartender with about one and a half years of experience. I prepare cocktails and non-alcoholic drinks to bar standards, welcome guests accurately, and keep a clean mise en place. I work reliably in a team and communicate clearly in English and Italian.',
    experience: [
      {
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Bartender',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(CANONICAL_BULLETS),
      },
    ],
    education: [
      {
        id: 'edu0',
        school: 'Hospitality College',
        degree: 'Bartending Certificate',
        startDate: '2023',
        endDate: '2023',
        description: '',
      },
    ],
    skills: ['Customer Service', 'Teamwork', 'Attention to Detail', 'Leadership'],
    certifications: [],
    languages: [
      { name: 'English', level: 'Advanced' },
      { name: 'Italian', level: 'Intermediate' },
    ],
    templateId: 'creative-artistic',
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
    skills: overrides.skills || base.skills,
  };
}

function longCreativeArtisticCv(withPhoto = false): CVData {
  const bullets = Array.from({ length: 7 }, (_, i) =>
    `• Delivered responsibility ${i + 1} for long-company-name-international-hospitality-group with precise service standards and reliable collaboration across busy service periods.`,
  ).join('\n');
  const experiences = Array.from({ length: 5 }, (_, i) => ({
    id: `exp-${i}`,
    company: `Very Long Employer Name International Group ${i + 1} Holdings LLC`,
    position: `Senior Creative Hospitality Specialist Role Title ${i + 1}`,
    startDate: `201${i}-01`,
    endDate: i === 0 ? '' : `201${i + 1}-12`,
    isPresent: i === 0,
    description: bullets,
  }));
  return bartenderCv({
    personal: {
      fullName: 'Ana Markovic',
      email: 'ana@example.com',
      phone: '+381 60 123 4567',
      address: 'Belgrade, Serbia',
      jobTitle: 'Senior Bartender and Bar Team Coordinator',
      photoEnabled: withPhoto,
      photo: withPhoto
        ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8DwnwEJMDGgAcQGALpCAwPXYZaSAAAAAElFTkSuQmCC'
        : undefined,
    },
    summary: [
      'Experienced bartender and hospitality professional with a multi-year track record of guest-focused service, precise drink preparation, and calm coordination in high-volume venues.',
      'I prepare cocktails and non-alcoholic drinks according to established recipes, welcome guests clearly, maintain mise en place, and uphold hygiene and service standards.',
      'I collaborate reliably with colleagues, communicate in English and Italian at intermediate to advanced levels, and continuously refine technique without inventing unsupported duties.',
      'My professional focus is consistent quality, accurate orders, and a welcoming bar experience for every guest across peak service windows and special venue moments when already part of the role.',
    ].join(' '),
    experience: experiences,
    education: [
      {
        id: 'e1',
        school: 'International School of Hospitality Management and Culinary Practice',
        degree: 'Advanced Diploma in Beverage Operations',
        startDate: '2018',
        endDate: '2020',
        description: 'Beverage theory and guest operations.',
      },
      {
        id: 'e2',
        school: 'City College of Applied Arts',
        degree: 'Certificate in Service Design',
        startDate: '2016',
        endDate: '2017',
        description: '',
      },
    ],
    skills: [
      'Customer Service',
      'Teamwork',
      'Attention to Detail',
      'Leadership',
      'Communication',
      'Organization',
      'Time Management',
      'Adaptability',
      'Problem Solving',
      'Presentation Skills',
    ],
    languages: [
      { name: 'English', level: 'Advanced' },
      { name: 'Italian', level: 'Intermediate' },
      { name: 'Serbian', level: 'Native' },
      { name: 'German', level: 'Basic' },
    ],
  });
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractDocxText(xml: string): string {
  const parts = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1]));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeParityText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\u2060/g, '')
    .replace(/[•·●]/g, ' ')
    .replace(/[–—|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

type DirectPdfInstance = {
  pages: number;
  drawnText: string[];
  addPage: ReturnType<typeof vi.fn>;
};

function installDirectPdfMocks() {
  const instances: DirectPdfInstance[] = [];
  vi.doMock('jspdf', () => ({
    jsPDF: class MockPdf {
      pages = 1;
      drawnText: string[] = [];
      addImage = vi.fn();
      addPage = vi.fn(() => { this.pages += 1; });
      setFont = vi.fn();
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      setFillColor = vi.fn();
      setDrawColor = vi.fn();
      setLineWidth = vi.fn();
      rect = vi.fn();
      line = vi.fn();
      text = vi.fn((t: string | string[]) => {
        const parts = Array.isArray(t) ? t : [t];
        this.drawnText.push(...parts);
      });
      splitTextToSize = vi.fn((text: string) => {
        if (!text) return [];
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          const next = cur ? `${cur} ${w}` : w;
          if (next.length > 42 && cur) {
            lines.push(cur);
            cur = w;
          } else cur = next;
        }
        if (cur) lines.push(cur);
        return lines.length ? lines : [text];
      });
      getTextWidth = vi.fn(() => 20);
      output() {
        return new Blob(['%PDF-1.7\nca-integrity\n%%EOF'], { type: 'application/pdf' });
      }
      constructor() { instances.push(this as unknown as DirectPdfInstance); }
    },
  }));
  return { instances };
}

async function exportDocxXml(cv: CVData, locale: Locale): Promise<string> {
  const { exportToDOCX } = await import('@/lib/export');
  let savedBlob: Blob | undefined;
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      savedBlob = blob;
      return 'blob:http://test/docx';
    }),
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
  });
  const clickSpy = vi.fn();
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    const el = realCreateElement(tagName);
    if (tagName.toLowerCase() === 'a') el.click = clickSpy;
    return el;
  });
  await exportToDOCX(cv, `ca-${locale}`, locale, 'creative-artistic');
  expect(savedBlob).toBeDefined();
  const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
  return zip.file('word/document.xml')!.async('text');
}

describe('Creative Artistic multilingual content integrity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test('canonical fact IDs are stable and bullets lock across all 12 locales (offline AI)', () => {
    const cv = bartenderCv();
    const factSet = buildCvCanonicalFactSet(cv);
    const ids = bulletsForExperience(factSet, 0).map((b) => b.id);
    expect(ids).toEqual([
      'experience-0-bullet-0',
      'experience-0-bullet-1',
      'experience-0-bullet-2',
      'experience-0-bullet-3',
    ]);

    for (const locale of LOCALES) {
      const offline = generateBulletsOffline('hospitality', 'mid', 'Atelje Bar', locale, cv.experience[0].description);
      const lines = splitExperienceBullets(offline);
      expect(lines).toHaveLength(4);
      expect(lines[0]).toContain('Prepared and served cocktails');
      expect(offline.toLowerCase()).not.toMatch(/allerg|muddling|wastage|evening shift|kitchen staff|syrup/);
    }
  });

  test('semantic fidelity rejects unsupported duties not present in canonical facts', () => {
    const factSet = buildCvCanonicalFactSet(bartenderCv());
    const bad = [
      '• Checked guest allergies during service.',
      '• Prepared seasonal signature cocktails with muddling.',
      '• Recorded wastage and inventory shortages.',
      '• Coordinated evening shifts with kitchen staff.',
    ].join('\n');
    const result = validateLocalizedExperienceBullets(bad, factSet, {
      locale: 'en',
      experienceIndex: 0,
      stage: 'initial',
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === 'unsupported_duty')).toBe(true);

    const countMismatch = validateLocalizedExperienceBullets(
      '• Checked guest allergies during service.\n• Prepared seasonal signature cocktails with muddling.',
      factSet,
      { locale: 'en', experienceIndex: 0, stage: 'initial' },
    );
    expect(countMismatch.violations.some((v) => v.kind === 'bullet_count_mismatch')).toBe(true);
  });

  test('activation repair/fallback cannot introduce new facts', async () => {
    const factSet = buildCvCanonicalFactSet(bartenderCv());
    const activated = await activateCvExperienceBullets({
      locale: 'en',
      experienceIndex: 0,
      factSet,
      candidate: '• Invented allergy checking and muddling syrups for evening shifts.',
      repair: async () => '• Still inventing wastage tracking and kitchen staff cooperation.\n• Extra bullet.',
    });
    expect(activated.status).toBe('fallback');
    expect(activated.fallbackUsed).toBe(true);
    const lines = splitExperienceBullets(activated.content);
    expect(lines).toHaveLength(4);
    expect(activated.content.toLowerCase()).not.toMatch(/allerg|muddling|wastage|kitchen/);
    expect(activated.content).toBe(deterministicBulletsFromCanonical(bulletsForExperience(factSet, 0)));
  });

  test('Hindi truncated summary is rejected and complete fallback activated', async () => {
    const truncated = 'आगे चलकर मैं अपने बारटेंडिंग कौशल को और परिष्कृत करते हु';
    expect(validateSummaryCompleteness(truncated, { locale: 'hi' }).valid).toBe(false);

    const factSet = buildCvCanonicalFactSet(bartenderCv());
    const activated = await activateCvSummary({
      locale: 'hi',
      gender: 'female',
      factSet,
      candidate: truncated,
      sourceFactsText: CANONICAL_BULLETS.join('\n'),
      fallbackSummary: truncated,
      repair: async () => truncated,
    });
    expect(activated.status).toBe('fallback');
    expect(activated.content).not.toContain('करते हु');
    expect(validateSummaryCompleteness(activated.content, { locale: 'hi' }).valid).toBe(true);
    expect(activated.content.toLowerCase()).not.toMatch(/allerg|muddling|wastage/);
  });

  test('gender regressions: Serbian/Russian female reject; EN/JA stay neutral', () => {
    const factSet = buildCvCanonicalFactSet(bartenderCv());

    const srBad = validateLocalizedSummary(
      'Lako se uklapa u kolektiv i spreman je da preuzme inicijativu. Pripremala sam koktele prateći tehnikama šejkovanja.',
      factSet,
      { locale: 'sr', gender: 'female' },
    );
    expect(srBad.valid).toBe(false);
    expect(srBad.violations.some((v) => /spreman je/i.test(v.matched))).toBe(true);
    expect(srBad.violations.some((v) => /prateći tehnikama/i.test(v.matched))).toBe(true);

    const ruBad = validateLocalizedSummary(
      'Опытный бартендер с опытом работы, специализирующаяся на коктейлях. Командный игрок, способная быстро адаптироваться.',
      factSet,
      { locale: 'ru', gender: 'female' },
    );
    expect(ruBad.valid).toBe(false);

    const hrBad = validateLocalizedExperienceBullets(
      '• Upravljala sam gostima za šankom\n• Primala narudžbe\n• Pripremala pića\n• Održavala higijenu',
      factSet,
      { locale: 'hr', gender: 'female', experienceIndex: 0 },
    );
    expect(hrBad.valid).toBe(false);
    expect(hrBad.violations.some((v) => /Upravljala sam gostima/i.test(v.matched))).toBe(true);

    const srMale = validateLocalizedSummary(
      'Lako se uklapa u kolektiv i spremna je da preuzme inicijativu.',
      factSet,
      { locale: 'sr', gender: 'male' },
    );
    expect(srMale.violations.some((v) => v.kind === 'gender_form_mismatch')).toBe(true);

    const enOk = validateLocalizedSummary(bartenderCv().summary, factSet, {
      locale: 'en',
      gender: 'female',
    });
    expect(enOk.valid).toBe(true);

    const jaOk = validateLocalizedSummary(
      '約1年半の経験を持つバーテンダーです。レシピに沿ってカクテルを提供し、細部への注意力を大切にしています。',
      factSet,
      { locale: 'ja', gender: 'female' },
    );
    expect(jaOk.valid).toBe(true);

    const unspecified = validateLocalizedSummary(
      'Bartender with experience preparing cocktails and welcoming guests.',
      factSet,
      { locale: 'en', gender: 'unspecified' },
    );
    expect(unspecified.valid).toBe(true);
  });

  test('locale quality phrases and language-level consistency checks', () => {
    const factSet = buildCvCanonicalFactSet(bartenderCv());
    expect(validateLocalizedSummary('perfil de cada mesa na orientação.', factSet, { locale: 'pt-BR' }).valid).toBe(false);
    expect(validateLocalizedSummary('su manejo del inglés en nivel avanzado es fuerte.', factSet, { locale: 'es' }).valid).toBe(false);
    expect(validateLocalizedSummary('Grundkenntnisse im Italienischen und hauseigene Erfahrung.', factSet, { locale: 'de' }).valid).toBe(false);
    expect(validateLocalizedSummary('des notions en italien complètent le profil.', factSet, { locale: 'fr' }).valid).toBe(false);
    expect(validateLocalizedSummary('アテンション・トゥ・ディテールを重視します。', factSet, { locale: 'ja' }).valid).toBe(false);
    expect(
      validateLocalizedExperienceBullets(
        '• Preparò cocktail\n• Gestì clienti\n• Mantenne igiene\n• Supportò colleghi',
        factSet,
        { locale: 'it', experienceIndex: 0 },
      ).valid,
    ).toBe(false);

    expect(translations.fr.cv.summary).toBe('Profil professionnel');
    expect(translations.it.cv.summary).toBe('Profilo professionale');
    expect(translations.de.cv.summary).toBe('Berufliches Profil');
    expect(getLocalizedCvSkillName('Attention to Detail', 'ja')).toBe('細部への注意力');
    expect(getLocalizedCvSkillName('アテンション・トゥ・ディテール', 'ja')).toBe('細部への注意力');
  });

  test('language proficiency localization policy for known enums; custom preserved', () => {
    expect(localizeCvLanguageLevel('Advanced', 'de')).toBe('Fortgeschritten');
    expect(localizeCvLanguageLevel('Intermediate', 'de')).toBe('Mittelstufe');
    expect(localizeCvLanguageLevel('Advanced', 'es')).toBe('Avanzado');
    expect(localizeCvLanguageLevel('Intermediate', 'fr')).toBe('Intermédiaire');
    expect(localizeCvLanguageLevel('Advanced', 'it')).toBe('Avanzato');
    expect(localizeCvLanguageLevel('Intermediate', 'pt-BR')).toBe('Intermediário');
    expect(localizeCvLanguageLevel('Advanced', 'sr')).toBe('Napredni');
    expect(localizeCvLanguageLevel('Intermediate', 'hr')).toBe('Srednja razina');
    expect(localizeCvLanguageLevel('Advanced', 'ru')).toBe('Продвинутый');
    expect(localizeCvLanguageLevel('Intermediate', 'hi')).toBe('मध्यम');
    expect(localizeCvLanguageLevel('Advanced', 'ja')).toBe('上級');
    expect(localizeCvLanguageLevel('Intermediate', 'ar')).toBe('متوسط');
    expect(localizeCvLanguageLevel('C2 Cambridge custom', 'de')).toBe('C2 Cambridge custom');
  });

  test('Arabic Creative Artistic DOCX sets bidi/RTL alignment and mirrors skills/languages', async () => {
    const xml = await exportDocxXml(bartenderCv(), 'ar');
    expect(xml).toContain('w:bidi');
    expect(xml).toMatch(/w:jc[^>]*w:val="right"/);
    expect(xml).toContain('Atelje Bar');
    expect(xml).toContain('ana@example.com');
    // Mirrored columns: Languages cell text should appear before Skills heading order differs vs English,
    // but both section labels exist.
    expect(xml).toContain(translations.ar.cv.skills);
    expect(xml).toContain(translations.ar.cv.languages);
    expect(xml).toContain(localizeCvLanguageLevel('Advanced', 'ar'));
  });

  test('PDF/DOCX normalized factual parity across all 12 locales', async () => {
    const cv = bartenderCv();
    for (const locale of LOCALES) {
      const root = createCreativeArtisticPdfTemplate(cv, { locale });
      const pdfText = normalizeParityText(root.textContent || '');
      const xml = await exportDocxXml(cv, locale);
      const docxText = normalizeParityText(extractDocxText(xml));

      expect(pdfText).toContain(normalizeParityText('Atelje Bar'));
      expect(docxText).toContain(normalizeParityText('Atelje Bar'));
      expect(pdfText).toContain(normalizeParityText('Bartender'));
      expect(docxText).toContain(normalizeParityText('Bartender'));
      for (const bullet of CANONICAL_BULLETS) {
        const token = normalizeParityText(bullet).slice(0, 28);
        expect(pdfText, `pdf locale=${locale}`).toContain(token);
        expect(docxText, `docx locale=${locale}`).toContain(token);
      }
      const adv = normalizeParityText(localizeCvLanguageLevel('Advanced', locale));
      const mid = normalizeParityText(localizeCvLanguageLevel('Intermediate', locale));
      expect(pdfText).toContain(adv);
      expect(docxText).toContain(adv);
      expect(pdfText).toContain(mid);
      expect(docxText).toContain(mid);
      expect(splitExperienceBullets(cv.experience[0].description)).toHaveLength(4);
    }
  }, 120_000);

  test('short one-page Creative Artistic PDF regression remains single page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const blob = await mod.buildCreativeArtisticPdfBlob(bartenderCv(), 'en');
    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
  });

  test('long multi-page Creative Artistic PDF (≥3) and DOCX keep-with-next safeguards', async () => {
    const longCv = longCreativeArtisticCv(false);
    const longCvPhoto = longCreativeArtisticCv(true);
    const pageLocales: Locale[] = ['en', 'de', 'sr', 'hi', 'ja', 'ar'];

    for (const locale of pageLocales) {
      vi.resetModules();
      const { instances } = installDirectPdfMocks();
      const mod = await import('@/lib/export');
      const blob = await mod.buildCreativeArtisticPdfBlob(longCv, locale);
      expect(blob.size).toBeGreaterThan(0);
      expect(instances.length, `jspdf instance locale=${locale}`).toBeGreaterThan(0);
      expect(instances[0].pages, `pdf pages locale=${locale}`).toBeGreaterThanOrEqual(3);
      expect(instances[0].addPage.mock.calls.length).toBeGreaterThanOrEqual(2);
    }

    vi.resetModules();
    {
      const { instances } = installDirectPdfMocks();
      const mod = await import('@/lib/export');
      await mod.buildCreativeArtisticPdfBlob(longCvPhoto, 'en');
      expect(instances[0].pages).toBeGreaterThanOrEqual(3);
    }

    // Factual content + pagination/keep-with-next for representative DOCX locales.
    for (const locale of ['en', 'de', 'ar'] as Locale[]) {
      const xml = await exportDocxXml(longCv, locale);
      expect(xml).toContain('w:keepNext');
      expect(xml).toContain('Very Long Employer Name');
      expect(xml).toContain('Delivered responsibility 1');
      expect(extractDocxText(xml).length).toBeGreaterThan(400);
      if (locale === 'ar') {
        expect(xml).toContain('w:bidi');
        expect(xml).toMatch(/w:jc[^>]*w:val="right"/);
      }
    }
  }, 120_000);

  test('deterministic summary fallback is always complete and grounded', () => {
    const factSet = buildCvCanonicalFactSet(bartenderCv());
    const summary = deterministicSummaryFromCanonical(factSet);
    expect(validateSummaryCompleteness(summary).valid).toBe(true);
    expect(summary.toLowerCase()).toContain('bartender');
    expect(summary.toLowerCase()).not.toMatch(/allerg|muddling|wastage/);
  });
});
