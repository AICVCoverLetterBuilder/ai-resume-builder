/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { CVData } from '@/lib/types';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildCvExportRenderProjection } from '@/lib/cv-export-structured-text';
import { exportToDOCX, resolveCvForPdfExport } from '@/lib/export';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import { enrichSerbianSummaryEmploymentGrounding } from '@/lib/cv-serbian-latin-script';

const SUMMARY = 'Radim kao prodavac u kompaniji Tehnomanija oko 9 meseci. Pružam stručnu podršku kupcima u procesu odabira i kupovine proizvoda, odgovoran sam za urednost i prezentaciju izložbenog prostora u skladu sa standardima prodajnog mesta, te svakodnevno sprovodim prodajne aktivnosti i vodim preciznu evidenciju o transakcijama.';

function physicalCv(): CVData {
  return {
    id: 'task-099', name: 'Task 099',
    personal: { fullName: 'Test', email: '', phone: '', address: '', jobTitle: 'Prodavac', gender: 'male' },
    summary: SUMMARY,
    summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: 'sr',
    contentLocale: 'sr',
    experience: [{ id: 'current', company: 'Tehnomanija', position: 'Prodavac', startDate: '2026-01', endDate: '', isPresent: true, description: 'Pružam podršku kupcima pri odabiru proizvoda. Održavam izložbeni prostor i vodim evidenciju o transakcijama.', descriptionOrigin: 'user', descriptionSourceLocale: 'sr' }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-10-09T00:00:00.000Z', updatedAt: '2026-10-09T00:00:00.000Z',
  } as CVData;
}

describe('Task 099 physical-equivalent export model', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
  });

  function preparedCv(source: CVData): CVData {
    const prepared = prepareExportReadyCv(source, 'sr', 'modern-minimal', { referenceDate: '2026-10-09' });
    expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true);
    if (!prepared.ok) throw new Error(prepared.reason);
    return prepared.cv;
  }

  it('preserves the persisted Summary verbatim for the PDF model', () => {
    const source = physicalCv();
    const prepared = prepareExportReadyCv(source, 'sr', 'modern-minimal', { referenceDate: '2026-10-09' });
    expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true);
    if (prepared.ok) expect(prepared.diagnostics.summaryInitialValid).toBe(true);
    if (prepared.ok) expect(prepared.diagnostics.summaryRecoverySource).toBe('saved_summary');
    if (prepared.ok) expect(resolveCvForPdfExport(prepared.cv).exportCv.summary).toBe(source.summary);
  });

  it('isolates the pre-fix mutation to Serbian export content quality', () => {
    const source = physicalCv();
    const hydrated = normalizeLegacyCvRuntime(source, 'sr');
    expect(hydrated.summary).toBe(source.summary);
    const enriched = enrichSerbianSummaryEmploymentGrounding(source.summary, {
      role: 'Prodavac', company: 'Tehnomanija', startDate: '2026-01',
    });
    expect(enriched).toContain('od januara 2026. godine');
    const quality = applyCvContentQuality(hydrated, 'sr', { referenceDate: '2026-10-09' });
    expect(quality.cv.summary).toContain('od januara 2026. godine');
    expect(source.summary).not.toContain('od januara 2026. godine');
  });

  it('preserves the persisted Summary verbatim for the DOCX render model', () => {
    const source = physicalCv();
    expect(buildCvExportRenderProjection(preparedCv(source), 'sr').summary).toBe(source.summary);
  });

  it('serializes the same Summary into a real DOCX document body', async () => {
    const source = physicalCv();
    let savedBlob: Blob | undefined;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        savedBlob = blob;
        return 'blob:http://test/task-099-docx';
      }),
    });
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = vi.fn();
      return el;
    });
    await exportToDOCX(preparedCv(source), 'task-099', 'sr', 'modern-minimal');
    expect(savedBlob).toBeDefined();
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('text');
    expect(xml).toContain(source.summary);
    expect(xml).not.toContain('od januara 2026. godine');
  });

  it('does not duplicate an explicitly authored start-date phrase', () => {
    const source = physicalCv();
    source.summary = source.summary.replace('oko 9 meseci.', 'oko 9 meseci od januara 2026. godine.');
    const exported = preparedCv(source).summary;
    expect(exported).toBe(source.summary);
    expect(exported.split('od januara 2026. godine')).toHaveLength(2);
  });

  it('keeps the existing empty-Summary export recovery contract', () => {
    const source = physicalCv();
    source.summary = '';
    const prepared = prepareExportReadyCv(source, 'sr', 'modern-minimal', { referenceDate: '2026-10-09' });
    expect(source.summary).toBe('');
    if (prepared.ok) expect(prepared.cv.summary).toBeTruthy();
  });

  it('does not insert a date from another Experience entry', () => {
    const source = physicalCv();
    source.experience.push({ ...source.experience[0], id: 'prior', company: 'Other Co', startDate: '', endDate: '', isPresent: false });
    expect(preparedCv(source).summary).toBe(SUMMARY);
  });

  it('does not import opaque project duration into Summary', () => {
    const source = physicalCv();
    source.skills.push('Project coordination (three-month assignment)');
    expect(preparedCv(source).summary).toBe(SUMMARY);
  });

  it('does not change Summary during a renderer projection in another locale', () => {
    const source = physicalCv();
    const exportCv = preparedCv(source);
    expect(buildCvExportRenderProjection(exportCv, 'de').summary).toBe(SUMMARY);
  });

  it('preserves unrelated numeric wording in the authoritative Summary', () => {
    const source = physicalCv();
    source.summary = source.summary.replace('preciznu evidenciju', 'preciznu evidenciju za 3 vrste');
    expect(preparedCv(source).summary).toBe(source.summary);
  });

  it('feeds PDF and DOCX the same Summary source', () => {
    const exportCv = preparedCv(physicalCv());
    expect(resolveCvForPdfExport(exportCv).exportCv.summary)
      .toBe(buildCvExportRenderProjection(exportCv, 'sr').summary);
  });

  it('does not mutate live CV state while preparing export', () => {
    const source = physicalCv();
    const before = JSON.stringify(source);
    preparedCv(source);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('remains identical across repeated export preparation', () => {
    const source = physicalCv();
    const first = preparedCv(source);
    expect(preparedCv(first).summary).toBe(source.summary);
  });
});
