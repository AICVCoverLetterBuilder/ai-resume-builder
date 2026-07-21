/**
 * AAB-295/296: stale Japanese Experience title in Croatian PDF/DOCX.
 * Provenance-aware projection — known occupations re-localize; manual free-text preserved.
 * Offline / deterministic only — no live AI provider requests.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { applyCvContentQuality } from '../cv-content-quality';
import { applyCanonicalExperienceEdit } from '../cv-canonical-snapshot';
import {
  EXPERIENCE_TITLE_PROJECTION_REVISION,
  localizeOccupationalTitleForProjection,
  matchesGraphicDesignerOccupationalTitle,
  resolveExperienceTitleForDisplay,
} from '../cv-role-title';
import { prepareExportReadyCv } from '../prepare-export-ready-cv';
import {
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
} from '../cv-croatian-summary-grounding';
import { EXPERIENCE_AI_NOOP_RECOVERY_REVISION } from '../cv-experience-ai-noop-recovery';
import { EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION } from '../cv-experience-unsupported-claims';

const HR_DESIGN_BULLETS = [
  '• Izrađivala je vizualne materijale i grafičke elemente prema brend smjernicama.',
  '• Pregledavala je i prilagođavala dizajne prema zahtjevima projekta.',
  '• Pripremala je datoteke za tisak i zaslon.',
].join('\n');

const HR_WH_BULLETS = [
  '• Provjerava ispravnost pristigle robe i točnost pripadajuće dokumentacije.',
  '• Ažurira skladišne evidencije te skrbi o urednom i preglednom rasporedu uskladištene robe.',
  '• Surađuje s kolegama pri pripremi i premještanju robe.',
].join('\n');

function annaCv(): CVData {
  return {
    personal: {
      fullName: 'Anna Kournikova',
      email: 'anna@example.com',
      phone: '',
      address: '',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary: '',
    contentLocale: 'hr',
    experience: [
      {
        id: 'exp-wh',
        position: 'Radnica u skladištu',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: HR_WH_BULLETS,
        originalUserDescription: HR_WH_BULLETS,
        canonicalDescription: HR_WH_BULLETS,
        descriptionOrigin: 'user',
      },
      {
        id: 'exp-design',
        position: 'グラフィックデザイナー',
        company: 'Rewitu',
        startDate: '2019-01',
        endDate: '2022-12',
        isPresent: false,
        description: HR_DESIGN_BULLETS,
        originalUserDescription: HR_DESIGN_BULLETS,
        canonicalDescription: HR_DESIGN_BULLETS,
        descriptionOrigin: 'user',
        positionProvenance: 'legacy_unknown',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

describe('cv-build295/296 stale foreign Experience title projection', () => {
  it('exposes title-projection revision marker', () => {
    expect(EXPERIENCE_TITLE_PROJECTION_REVISION).toBe('experience-title-projection-296-v1');
  });

  it('recognizes Japanese + Cyrillic graphic designer as known occupations', () => {
    expect(matchesGraphicDesignerOccupationalTitle('グラフィックデザイナー')).toBe(true);
    expect(matchesGraphicDesignerOccupationalTitle('Графический дизайнер')).toBe(true);
    expect(localizeOccupationalTitleForProjection('グラフィックデザイナー', 'hr', 'female'))
      .toBe('grafička dizajnerica');
    expect(resolveExperienceTitleForDisplay(
      { position: 'グラフィックデザイナー', positionProvenance: 'localized_generated' },
      'hr',
      'female',
    )).toBe('Grafička dizajnerica');
    expect(resolveExperienceTitleForDisplay(
      { position: 'Графический дизайнер', positionProvenance: 'legacy_unknown' },
      'hr',
      'female',
    )).toBe('Grafička dizajnerica');
  });

  it('A: Croatian content-quality projection rewrites stale JP design title only', () => {
    const { cv } = applyCvContentQuality(annaCv(), 'hr', { gender: 'female' });
    const design = cv.experience.find((e) => e.id === 'exp-design')!;
    const warehouse = cv.experience.find((e) => e.id === 'exp-wh')!;
    expect(design.position).toBe('Grafička dizajnerica');
    expect(design.position).not.toMatch(/グラフィック|デザイナー/);
    expect(warehouse.position).toBe('Radnica u skladištu');
    expect(warehouse.company).toBe('Atlas');
    expect(design.company).toBe('Rewitu');
  });

  it('B: export-ready CV (PDF/DOCX shared input) uses Croatian prior title', () => {
    const prepared = prepareExportReadyCv(annaCv(), 'hr');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const design = prepared.cv.experience.find((e) => e.id === 'exp-design')!;
    const warehouse = prepared.cv.experience.find((e) => e.id === 'exp-wh')!;
    expect(design.position).toBe('Grafička dizajnerica');
    expect(warehouse.position).toBe('Radnica u skladištu');
    expect(design.description).toMatch(/vizualne|grafičke/i);
    expect(design.description).not.toMatch(/グラフィック/);
  });

  it('C: explicit manual Japanese free-text title is preserved byte-for-byte', () => {
    const manual = {
      position: 'グラフィックデザイナー',
      positionProvenance: 'manual' as const,
      positionUserEdited: true,
    };
    expect(resolveExperienceTitleForDisplay(manual, 'hr', 'female'))
      .toBe('グラフィックデザイナー');

    let cv = annaCv();
    cv = {
      ...cv,
      experience: cv.experience.map((e) =>
        e.id === 'exp-design'
          ? { ...e, position: 'grafička dizajnerica', positionProvenance: 'localized_generated' }
          : e),
    };
    cv = applyCanonicalExperienceEdit(
      cv,
      'exp-design',
      'position',
      'グラフィックデザイナー',
      'hr',
    );
    const edited = cv.experience.find((e) => e.id === 'exp-design')!;
    expect(edited.positionUserEdited).toBe(true);
    expect(edited.positionProvenance).toBe('manual');
    expect(edited.position).toBe('グラフィックデザイナー');
    const { cv: projected } = applyCvContentQuality(cv, 'hr', { gender: 'female' });
    expect(projected.experience.find((e) => e.id === 'exp-design')!.position)
      .toBe('グラフィックデザイナー');
  });

  it('D: arbitrary Japanese free-text that is not a known occupation is preserved', () => {
    expect(localizeOccupationalTitleForProjection('特命シニアコーディネーター', 'hr', 'female'))
      .toBe('特命シニアコーディネーター');
    expect(resolveExperienceTitleForDisplay(
      { position: '特命シニアコーディネーター', positionProvenance: 'legacy_unknown' },
      'hr',
      'female',
    )).toBe('特命シニアコーディネーター');
  });

  it('E: stored state remains Japanese until display projection (display-only contract)', () => {
    const cv = annaCv();
    expect(cv.experience.find((e) => e.id === 'exp-design')!.position)
      .toBe('グラフィックデザイナー');
    const { cv: projected } = applyCvContentQuality(cv, 'hr', { gender: 'female' });
    expect(cv.experience.find((e) => e.id === 'exp-design')!.position)
      .toBe('グラフィックデザイナー');
    expect(projected.experience.find((e) => e.id === 'exp-design')!.position)
      .toBe('Grafička dizajnerica');
  });

  it('preserves prior Experience / Summary markers', () => {
    expect(EXPERIENCE_AI_NOOP_RECOVERY_REVISION).toBe('experience-ai-noop-recovery-293-v1');
    expect(EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION)
      .toBe('experience-ai-unsupported-expansion-295-v1');
    expect(EXPERIENCE_TITLE_PROJECTION_REVISION).toBe('experience-title-projection-296-v1');
    expect(CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION).toBe('croatian-summary-intro-grammar-292-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2).toBe('croatian-duration-idempotent-v2');
  });
});
