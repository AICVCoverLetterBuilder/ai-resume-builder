/**
 * @vitest-environment jsdom
 *
 * Locale-aware canonical snapshot, legacy migration, revisioning, stale projections.
 */
import { describe, expect, test } from 'vitest';
import {
  applyCanonicalExperienceEdit,
  applyCanonicalSummaryEdit,
  detectContentLocale,
  isProjectionFresh,
  migrateLegacyCanonicalCv,
  sealCanonicalFromValidatedSource,
  storeLocalizedProjection,
  buildProjectionFromLocalizedCv,
} from '@/lib/cv-canonical-snapshot';
import {
  applyCreativeArtisticExportIntegrity,
  CreativeArtisticLocaleExportError,
  prepareCreativeArtisticExport,
} from '@/lib/cv-export-integrity';
import { formatExperienceBullets, classifyDutyCategory } from '@/lib/cv-canonical-facts';
import { isEnglishCanonicalDump } from '@/lib/cv-localized-fallback';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

const SR_BULLETS = [
  'Pripremala i služila širok izbor koktela, pića i napitaka.',
  'Održavala čist i uređen bar i standarde higijene/bezbednosti.',
  'Pružala pažljivu uslugu gostima i gradila odnos poverenja.',
  'Upravljala nivoom zaliha, pomagala pri inventaru i javljala potrebe snabdevanja.',
];

const SR_SUMMARY =
  'Iskusna šankerka sa oko godinu i po iskustva. Pripremam koktele i napitke, održavam čist bar uz stroge standarde higijene, pružam pažljivu uslugu gostima i upravljam zalihama uz inventuru.';

const AR_BULLETS = [
  'حضّرت وقدّمت مجموعة واسعة من الكوكتيلات والمشروبات.',
  'حافظت على نظافة وتنظيم منطقة البار ومعايير النظافة والسلامة.',
  'قدّمت خدمة عملاء يقظة وبنيت علاقات جيدة مع الضيوف.',
  'أدرت مستويات المخزون وساعدت في الجرد وأبلغت احتياجات التوريد.',
];

const AR_SUMMARY =
  'باريستا ذات خبرة في تحضير الكوكتيلات والمشروبات، والحفاظ على نظافة البار، وخدمة الضيوف، وإدارة المخزون باحتراف.';

function baseCv(overrides: Partial<CVData> = {}): CVData {
  const base: CVData = {
    id: 'snap-test',
    name: 'Test',
    personal: {
      fullName: 'Ana',
      email: 'a@b.c',
      phone: '1',
      address: 'x',
      jobTitle: 'Bartender',
      gender: 'female',
    },
    summary: '',
    experience: [],
    education: [],
    skills: ['Customer Service'],
    certifications: [],
    languages: [{ name: 'English', level: 'Advanced' }],
    templateId: 'creative-artistic',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
  return {
    ...base,
    ...overrides,
    personal: { ...base.personal, ...(overrides.personal || {}) },
    experience: overrides.experience ?? base.experience,
    languages: overrides.languages ?? base.languages,
    skills: overrides.skills ?? base.skills,
  };
}

describe('locale-aware canonical snapshot', () => {
  test('Serbian-first source seals canonicalLocale=sr without English', () => {
    const cv = baseCv({
      summary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
      }],
    });
    expect(detectContentLocale(`${SR_SUMMARY}\n${SR_BULLETS.join('\n')}`)).toBe('sr');
    const sealed = sealCanonicalFromValidatedSource(cv, {
      locale: 'sr',
      createdFrom: 'user_structured_input',
    });
    expect(sealed.canonicalSnapshot?.canonicalLocale).toBe('sr');
    expect(sealed.canonicalSnapshot?.canonicalState).toBe('valid');
    expect(sealed.canonicalSnapshot?.canonicalRevision).toBe(1);
    expect(sealed.canonicalSnapshot?.canonicalSummary).toContain('šankerka');
    expect(sealed.canonicalSnapshot?.canonicalExperiences[0].bullets).toHaveLength(4);
    expect(sealed.canonicalSnapshot?.canonicalExperiences[0].bullets[0].factId).toBe('experience-0-bullet-0');
    expect(sealed.canonicalSummary?.toLowerCase()).not.toMatch(/prepared and served/);
  });

  test('Hindi-first and Arabic-first seal without English intermediate', () => {
    const hiSummary = 'अनुभवी बारटेंडर जो कॉकटेल और पेय तैयार करती है, बार को स्वच्छ रखती है, अतिथियों की सेवा करती है और इन्वेंटरी प्रबंधित करती है।';
    const hiBullets = [
      'कॉकटेल, स्पिरिट और पेय तैयार कर परोसे।',
      'बार क्षेत्र को साफ और व्यवस्थित रखा तथा स्वच्छता मानकों का पालन किया।',
      'अतिथियों को ध्यानपूर्ण सेवा दी और संबंध बनाए।',
      'स्टॉक स्तर प्रबंधित किए और इन्वेंटरी में सहायता की।',
    ];
    const hi = sealCanonicalFromValidatedSource(baseCv({
      summary: hiSummary,
      experience: [{
        id: 'exp0',
        company: 'Bar',
        position: 'Bartender',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(hiBullets),
      }],
    }), { locale: 'hi', createdFrom: 'user_structured_input' });
    expect(hi.canonicalSnapshot?.canonicalLocale).toBe('hi');
    expect(hi.canonicalSnapshot?.canonicalState).toBe('valid');

    const ar = sealCanonicalFromValidatedSource(baseCv({
      summary: AR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'بار',
        position: 'نادلة بار',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(AR_BULLETS),
      }],
    }), { locale: 'ar', createdFrom: 'user_structured_input' });
    expect(ar.canonicalSnapshot?.canonicalLocale).toBe('ar');
    expect(ar.canonicalSnapshot?.canonicalState).toBe('valid');
  });

  test('locale switch does not recreate snapshot or increment revision', () => {
    let cv = sealCanonicalFromValidatedSource(baseCv({
      summary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
        canonicalDescription: formatExperienceBullets(SR_BULLETS),
      }],
      canonicalSummary: SR_SUMMARY,
    }), { locale: 'sr', createdFrom: 'user_structured_input' });
    const rev = cv.canonicalSnapshot!.canonicalRevision;
    const hash = cv.canonicalSnapshot!.canonicalSourceHash;
    const facts = cv.canonicalSnapshot!.canonicalExperiences[0].bullets.map((b) => b.factId);

    // Simulate UI locale switch → seal without revise must be no-op.
    cv = sealCanonicalFromValidatedSource(cv, { locale: 'en', createdFrom: 'validated_ai_result' });
    expect(cv.canonicalSnapshot?.canonicalLocale).toBe('sr');
    expect(cv.canonicalSnapshot?.canonicalRevision).toBe(rev);
    expect(cv.canonicalSnapshot?.canonicalSourceHash).toBe(hash);
    expect(cv.canonicalSnapshot?.canonicalExperiences[0].bullets.map((b) => b.factId)).toEqual(facts);
  });

  test('editing canonical bullets/summary/role increments revision; export does not', () => {
    let cv = sealCanonicalFromValidatedSource(baseCv({
      summary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
        canonicalDescription: formatExperienceBullets(SR_BULLETS),
      }],
      canonicalSummary: SR_SUMMARY,
    }), { locale: 'sr', createdFrom: 'user_structured_input' });
    expect(cv.canonicalSnapshot?.canonicalRevision).toBe(1);

    cv = applyCanonicalExperienceEdit(cv, 'exp0', 'company', 'Nova Kompanija', 'sr');
    expect(cv.canonicalSnapshot?.canonicalRevision).toBe(2);
    const hash2 = cv.canonicalSnapshot!.canonicalSourceHash;

    const nextSummary = `${SR_SUMMARY} Dodatno iskustvo u vođenju smene.`;
    cv = applyCanonicalSummaryEdit(cv, nextSummary, 'sr');
    expect(cv.canonicalSnapshot?.canonicalRevision).toBe(3);
    expect(cv.canonicalSnapshot?.canonicalSourceHash).not.toBe(hash2);

    const beforeExport = cv.canonicalSnapshot!.canonicalRevision;
    prepareCreativeArtisticExport(cv, 'sr', { gender: 'female' });
    expect(cv.canonicalSnapshot?.canonicalRevision).toBe(beforeExport);
  });

  test('stale projection cannot export; regenerated projection carries new revision/hash', () => {
    let cv = sealCanonicalFromValidatedSource(baseCv({
      summary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
        canonicalDescription: formatExperienceBullets(SR_BULLETS),
      }],
      canonicalSummary: SR_SUMMARY,
    }), { locale: 'sr', createdFrom: 'user_structured_input' });

    const first = prepareCreativeArtisticExport(cv, 'de', { gender: 'female' });
    cv = storeLocalizedProjection(cv, first.projection);
    expect(isProjectionFresh(cv.localizedProjections!.de, cv.canonicalSnapshot)).toBe(true);

    cv = applyCanonicalExperienceEdit(cv, 'exp0', 'position', 'Glavna šankerka', 'sr');
    expect(isProjectionFresh(cv.localizedProjections!.de, cv.canonicalSnapshot)).toBe(false);

    const recovered = prepareCreativeArtisticExport(cv, 'de', { gender: 'female' });
    expect(recovered.projection.canonicalRevision).toBe(cv.canonicalSnapshot!.canonicalRevision);
    expect(recovered.projection.canonicalSourceHash).toBe(cv.canonicalSnapshot!.canonicalSourceHash);
    expect(recovered.projection.requestedLocale).toBe('de');
    expect(recovered.projection.canonicalLocale).toBe('sr');
  });
});

describe('legacy canonical migration', () => {
  test('reliable Serbian legacy migrates once; idempotent', () => {
    const legacy = baseCv({
      summary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
      }],
    });
    const once = migrateLegacyCanonicalCv(legacy);
    expect(once.canonicalSnapshot?.canonicalLocale).toBe('sr');
    expect(once.canonicalSnapshot?.canonicalState).toBe('valid');
    expect(once.canonicalSnapshot?.canonicalRevision).toBe(1);
    expect(once.summary).toBe(SR_SUMMARY);
    const twice = migrateLegacyCanonicalCv(once);
    expect(twice.canonicalSnapshot?.canonicalRevision).toBe(1);
    expect(twice.canonicalSnapshot?.canonicalSourceHash).toBe(once.canonicalSnapshot?.canonicalSourceHash);
  });

  test('reliable Arabic legacy migrates with ar locale', () => {
    const legacy = baseCv({
      summary: AR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'بار',
        position: 'نادلة بار',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(AR_BULLETS),
      }],
    });
    const migrated = migrateLegacyCanonicalCv(legacy);
    expect(migrated.canonicalSnapshot?.canonicalLocale).toBe('ar');
    expect(migrated.canonicalSnapshot?.canonicalState).toBe('valid');
    expect(migrated.summary).toBe(AR_SUMMARY);
  });

  test('truncated Hindi legacy preserves text, needs_rebuild, never English, blocks export', () => {
    const stub = 'आगेचलकर मैंअप';
    const legacy = baseCv({
      summary: stub,
      experience: [{
        id: 'exp0',
        company: 'Bar',
        position: 'Bartender',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: '• काम',
      }],
    });
    const migrated = migrateLegacyCanonicalCv(legacy, { localeHint: 'hi' });
    expect(migrated.summary).toBe(stub);
    expect(migrated.canonicalSnapshot?.canonicalState).toBe('needs_rebuild');
    expect(migrated.canonicalSnapshot?.canonicalLocale).toBe('hi');
    expect(migrated.canonicalSnapshot?.canonicalCreatedFrom).toBe('legacy_migration');
    expect(() => applyCreativeArtisticExportIntegrity(migrated, 'hi', { gender: 'female' }))
      .toThrow(CreativeArtisticLocaleExportError);
    expect(() => applyCreativeArtisticExportIntegrity(migrated, 'en', { gender: 'female' }))
      .toThrow(/needs_rebuild/);
  });

  test('ambiguous locale becomes needs_rebuild without forced English assumption on content', () => {
    const legacy = baseCv({
      summary: 'xyzzy plugh unique',
      experience: [{
        id: 'exp0',
        company: 'X',
        position: 'Y',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: '• blah blah unique nonsense token qqzz',
      }],
    });
    const migrated = migrateLegacyCanonicalCv(legacy);
    expect(migrated.canonicalSnapshot?.canonicalState).toBe('needs_rebuild');
    expect(migrated.summary).toBe('xyzzy plugh unique');
    expect(migrated.experience[0].description).toContain('qqzz');
    expect(migrated.experience[0].description.toLowerCase()).not.toContain('prepared and served');
  });

  test('already valid snapshot is left untouched', () => {
    const sealed = sealCanonicalFromValidatedSource(baseCv({
      summary: SR_SUMMARY,
      canonicalSummary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
        canonicalDescription: formatExperienceBullets(SR_BULLETS),
      }],
    }), { locale: 'sr', createdFrom: 'user_structured_input' });
    const again = migrateLegacyCanonicalCv(sealed);
    expect(again).toBe(sealed);
  });
});

describe('PDF/DOCX one projection', () => {
  test('prepare returns identical projection metadata for repeated consumers', () => {
    const cv = sealCanonicalFromValidatedSource(baseCv({
      summary: SR_SUMMARY,
      canonicalSummary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
        canonicalDescription: formatExperienceBullets(SR_BULLETS),
      }],
      languages: [
        { name: 'English', level: 'Advanced' },
        { name: 'Italian', level: 'Intermediate' },
      ],
    }), { locale: 'sr', createdFrom: 'user_structured_input' });

    const pdfPrep = prepareCreativeArtisticExport(cv, 'sr', { gender: 'female' });
    const docxPrep = prepareCreativeArtisticExport(cv, 'sr', { gender: 'female' });
    expect(pdfPrep.projection.projectionId).toBe(docxPrep.projection.projectionId);
    expect(pdfPrep.projection.requestedLocale).toBe('sr');
    expect(pdfPrep.projection.canonicalLocale).toBe('sr');
    expect(pdfPrep.projection.canonicalRevision).toBe(docxPrep.projection.canonicalRevision);
    expect(pdfPrep.projection.canonicalSourceHash).toBe(docxPrep.projection.canonicalSourceHash);
    expect(pdfPrep.projection.localizedExperiences[0].bullets.map((b) => b.factId))
      .toEqual(docxPrep.projection.localizedExperiences[0].bullets.map((b) => b.factId));
    expect(pdfPrep.projection.localizedLanguageLevels.map((l) => l.level))
      .toEqual(docxPrep.projection.localizedLanguageLevels.map((l) => l.level));
  });

  test('semantic categories preserved when localizing from Serbian canonical', () => {
    const cv = sealCanonicalFromValidatedSource(baseCv({
      summary: SR_SUMMARY,
      canonicalSummary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje Bar',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
        canonicalDescription: formatExperienceBullets(SR_BULLETS),
      }],
    }), { locale: 'sr', createdFrom: 'user_structured_input' });
    const cats = cv.canonicalSnapshot!.canonicalExperiences[0].bullets.map((b) => b.semanticCategory);
    expect(cats[0]).toBe(classifyDutyCategory(SR_BULLETS[0]));
    const de = prepareCreativeArtisticExport(cv, 'de', { gender: 'female' });
    expect(de.projection.localizedExperiences[0].bullets.map((b) => b.semanticCategory)).toEqual(cats);
    expect(de.projection.canonicalLocale).toBe('sr');
  });
});

describe('projection freshness helpers', () => {
  test('buildProjectionFromLocalizedCv tags revision/hash', () => {
    const cv = sealCanonicalFromValidatedSource(baseCv({
      summary: SR_SUMMARY,
      canonicalSummary: SR_SUMMARY,
      experience: [{
        id: 'exp0',
        company: 'Atelje',
        position: 'Šankerka',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: formatExperienceBullets(SR_BULLETS),
        canonicalDescription: formatExperienceBullets(SR_BULLETS),
      }],
    }), { locale: 'sr', createdFrom: 'user_structured_input' });
    const proj = buildProjectionFromLocalizedCv(cv, cv, 'sr' as Locale, 'passed');
    expect(proj.canonicalRevision).toBe(1);
    expect(proj.projectionId).toMatch(/^proj-/);
    expect(isProjectionFresh(proj, cv.canonicalSnapshot)).toBe(true);
  });
});
