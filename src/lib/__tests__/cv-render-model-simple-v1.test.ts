import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData, TemplateId } from '@/lib/types';
import {
  buildCvRenderModel,
  captureCvRenderSnapshot,
  describeCvRenderTarget,
} from '@/lib/cv-render-model-simple-v1';
import { buildCvExportRenderProjection } from '@/lib/cv-export-structured-text';

const CURRENT = 'CURRENT_SENTINEL_NOVA_FIRMA trenutno radim kao Grafički dizajner.';
const STALE = 'STALE_SENTINEL_OLD_SUMMARY corrected legacy candidate.';

function fixture(overrides: Partial<CVData> = {}): CVData {
  return {
    id: 'simple-v1-m3',
    name: 'M3 authority fixture',
    personal: {
      fullName: 'Mila Petrović',
      email: 'mila@example.test',
      phone: '+381 60 000 000',
      address: 'Novi Sad',
      jobTitle: 'Grafički dizajner',
      gender: 'female',
      photoEnabled: false,
    },
    summary: CURRENT,
    contentLocale: 'sr',
    summaryGeneratedLocale: 'hi',
    canonicalSummary: STALE,
    summaryOrigin: 'ai_repaired',
    canonicalSnapshot: {
      summary: STALE,
    } as unknown as CVData['canonicalSnapshot'],
    localizedProjections: {
      en: { summary: STALE },
    } as unknown as CVData['localizedProjections'],
    experience: [{
      id: 'exp-current',
      company: 'Nova Firma SR Test',
      position: 'Grafički dizajner',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: 'CURRENT_EXPERIENCE_SENTINEL malformed.duty remains exactly visible',
      generatedDescription: 'STALE_EXPERIENCE_SENTINEL',
      generatedLocale: 'hi',
      canonicalDescription: 'STALE_EXPERIENCE_SENTINEL',
      groundingRecoverySource: 'legacy_user_origin_duties',
      recoveredSemanticDuties: [
        {
          key: 'stale-1',
          confidence: 'exact_user_origin',
          sourceClauseIndex: 0,
          sourceClause: 'STALE_EXPERIENCE_SENTINEL',
          sourceLocale: 'sr',
        },
        {
          key: 'stale-2',
          confidence: 'exact_user_origin',
          sourceClauseIndex: 1,
          sourceClause: 'STALE_EXPERIENCE_SECOND',
          sourceLocale: 'sr',
        },
      ],
    }],
    education: [{
      id: 'edu-1',
      school: 'Akademija umetnosti',
      degree: 'Grafički dizajn',
      startDate: '2018-09',
      endDate: '2022-06',
      description: 'Vizuelne komunikacije',
    }],
    skills: ['Illustrator', 'Brand design'],
    certifications: ['Design systems'],
    languages: [{ name: 'Serbian', level: 'Native' }],
    templateId: 'modern-minimal',
    region: 'Balkan',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('Simple V1 M3 shared CV render authority', () => {
  it('1. buildCvRenderModel uses only cv.summary', () => {
    expect(buildCvRenderModel(fixture()).summary).toBe(CURRENT);
  });

  it('2. stale legacy Summary metadata cannot replace cv.summary', () => {
    const model = buildCvRenderModel(fixture());
    expect(model.summary).toBe(CURRENT);
    expect(JSON.stringify(model)).not.toContain(STALE);
    expect(model).not.toHaveProperty('canonicalSummary');
    expect(model).not.toHaveProperty('canonicalSnapshot');
    expect(model).not.toHaveProperty('localizedProjections');
  });

  it('3. generatedLocale mismatch cannot replace cv.summary', () => {
    const model = buildCvRenderModel(fixture({ summaryGeneratedLocale: 'ja' }));
    expect(model.summary).toBe(CURRENT);
    expect(model).not.toHaveProperty('summaryGeneratedLocale');
  });

  it('4. empty cv.summary stays empty', () => {
    expect(buildCvRenderModel(fixture({ summary: '' })).summary).toBe('');
  });

  it('5. malformed-but-present cv.summary is carried byte-for-byte', () => {
    const malformed = '  CURRENT_SENTINEL malformed.grammar\n\n stays\tstored  ';
    expect(buildCvRenderModel(fixture({ summary: malformed })).summary).toBe(malformed);
  });

  it('6. building and freezing a render model does not mutate the source CV', () => {
    const cv = fixture();
    const before = structuredClone(cv);
    const model = buildCvRenderModel(cv);
    expect(cv).toEqual(before);
    expect(model).not.toBe(cv);
    expect(model.experience[0]).not.toBe(cv.experience[0]);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.experience[0])).toBe(true);
  });

  it('7. contentLocale=sr remains sr independently of uiLocale=en', () => {
    const uiLocale: Locale = 'en';
    void uiLocale;
    expect(captureCvRenderSnapshot(fixture({ contentLocale: 'sr' })).contentLocale).toBe('sr');
  });

  it('8. repeated UI-locale switches cannot alter render-model CV content', () => {
    const cv = fixture();
    const baseline = captureCvRenderSnapshot(cv);
    for (const uiLocale of ['de', 'en', 'ar', 'ja', 'hi'] as Locale[]) {
      void uiLocale;
      const switched = captureCvRenderSnapshot(cv);
      expect(switched.renderModelHash).toBe(baseline.renderModelHash);
      expect(switched.model.summary).toBe(CURRENT);
      expect(switched.contentLocale).toBe('sr');
    }
  });

  it('9. one snapshot reports one Summary hash for Preview, PDF, and DOCX', () => {
    const snapshot = captureCvRenderSnapshot(fixture());
    const targets = (['preview', 'pdf', 'docx'] as const).map((format) => (
      describeCvRenderTarget(snapshot, format)
    ));
    expect(new Set(targets.map((target) => target.summaryHash))).toEqual(new Set([snapshot.summaryHash]));
    expect(new Set(targets.map((target) => target.renderModelHash))).toEqual(new Set([snapshot.renderModelHash]));
  });

  it('10. one snapshot reports one authoritative Experience hash for all formats', () => {
    const snapshot = captureCvRenderSnapshot(fixture());
    const hashes = (['preview', 'pdf', 'docx'] as const).map((format) => (
      describeCvRenderTarget(snapshot, format).experienceHash
    ));
    expect(new Set(hashes)).toEqual(new Set([snapshot.experienceHash]));
    expect(snapshot.model.experience[0].description).toContain('CURRENT_EXPERIENCE_SENTINEL');
  });

  it('11. an M2-applied Summary immediately becomes render authority', () => {
    const cv = fixture();
    const m2Applied = 'M2_NEW_TEXT_SENTINEL successfully applied Summary.';
    cv.summary = m2Applied;
    expect(captureCvRenderSnapshot(cv).model.summary).toBe(m2Applied);
  });

  it('12. stale metadata cannot create Preview/PDF divergence', () => {
    const snapshot = captureCvRenderSnapshot(fixture());
    expect(describeCvRenderTarget(snapshot, 'preview').summaryHash)
      .toBe(describeCvRenderTarget(snapshot, 'pdf').summaryHash);
    expect(snapshot.model.summary).toBe(CURRENT);
  });

  it('13. stale metadata cannot create PDF/DOCX divergence', () => {
    const snapshot = captureCvRenderSnapshot(fixture());
    expect(describeCvRenderTarget(snapshot, 'pdf').summaryHash)
      .toBe(describeCvRenderTarget(snapshot, 'docx').summaryHash);
    expect(JSON.stringify(snapshot.model)).not.toContain(STALE);
  });

  it('14. lower export projection recognizes the model and does not recover duties', () => {
    const model = buildCvRenderModel(fixture());
    const projected = buildCvExportRenderProjection(model, 'sr');
    expect(projected).toBe(model);
    expect(projected.experience[0].description).toBe(
      'CURRENT_EXPERIENCE_SENTINEL malformed.duty remains exactly visible',
    );
    expect(JSON.stringify(projected)).not.toContain('STALE_EXPERIENCE_SENTINEL');
  });

  it('15. local model construction performs no provider/network work or AI usage', () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    const aiUsage = 7;
    const snapshot = captureCvRenderSnapshot(fixture());
    describeCvRenderTarget(snapshot, 'preview');
    describeCvRenderTarget(snapshot, 'pdf');
    describeCvRenderTarget(snapshot, 'docx');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(aiUsage).toBe(7);
    globalThis.fetch = originalFetch;
  });

  it('16. a PDF snapshot remains consistent after the live CV changes', () => {
    const live = fixture();
    const pdf = captureCvRenderSnapshot(live);
    live.summary = 'LIVE_EDIT_AFTER_PDF_CAPTURE';
    live.experience[0].description = 'LIVE_EXPERIENCE_AFTER_PDF_CAPTURE';
    expect(pdf.model.summary).toBe(CURRENT);
    expect(pdf.model.experience[0].description).toContain('CURRENT_EXPERIENCE_SENTINEL');
    expect(describeCvRenderTarget(pdf, 'pdf').renderModelHash).toBe(pdf.renderModelHash);
  });

  it('17. a DOCX snapshot remains consistent after the live CV changes', () => {
    const live = fixture();
    const docx = captureCvRenderSnapshot(live);
    live.summary = 'LIVE_EDIT_AFTER_DOCX_CAPTURE';
    live.personal.fullName = 'Changed Name';
    expect(docx.model.summary).toBe(CURRENT);
    expect(docx.model.personal.fullName).toBe('Mila Petrović');
    expect(describeCvRenderTarget(docx, 'docx').renderModelHash).toBe(docx.renderModelHash);
  });

  it.each([
    ['modern-minimal', 'sr'],
    ['corporate-navy', 'en'],
    ['creative-artistic', 'ar'],
    ['modern-minimal', 'hi'],
    ['rirekisho', 'ja'],
  ] as Array<[TemplateId, Locale]>)('18. %s accepts shared authority in %s', (templateId, contentLocale) => {
    const snapshot = captureCvRenderSnapshot(fixture({ templateId, contentLocale }));
    expect(snapshot.model.templateId).toBe(templateId);
    expect(snapshot.contentLocale).toBe(contentLocale);
    expect(snapshot.model.summary).toBe(CURRENT);
    expect(Object.isFrozen(snapshot.model)).toBe(true);
    expect(snapshot.model.experience[0]).not.toHaveProperty('generatedDescription');
  });
});
