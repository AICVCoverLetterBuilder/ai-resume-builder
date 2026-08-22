/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { captureCvRenderSnapshot, withCvRenderModelPhoto } from '@/lib/cv-render-model-simple-v1';
import {
  buildModernMinimalPdfBlob,
  exportRirekishoToDOCX,
  exportToDOCX,
} from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';

const CURRENT = 'CURRENT_SENTINEL_NOVA_FIRMA exact stored summary authority';
const STALE = 'STALE_SENTINEL_OLD_SUMMARY hidden legacy candidate';

function fixture(templateId: CVData['templateId'] = 'modern-minimal'): CVData {
  return {
    id: `artifact-${templateId}`,
    name: 'Simple V1 artifact',
    personal: {
      fullName: 'Mila Petrovic',
      email: 'mila@example.test',
      phone: '+38160000000',
      address: 'Novi Sad',
      jobTitle: 'Graphic Designer',
      gender: 'female',
      photoEnabled: false,
    },
    summary: CURRENT,
    contentLocale: templateId === 'rirekisho' ? 'ja' : 'sr',
    canonicalSummary: STALE,
    summaryGeneratedLocale: 'hi',
    experience: [{
      id: 'exp-artifact',
      company: 'Nova Firma',
      position: 'Graphic Designer',
      positionProvenance: 'occupation_option',
      positionSourceKey: 'graphic_designer',
      positionSourceLocale: 'en',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: 'CURRENT_EXPERIENCE_ARTIFACT_SENTINEL',
      generatedDescription: 'STALE_EXPERIENCE_ARTIFACT_SENTINEL',
      generatedLocale: 'hi',
    }],
    education: [],
    skills: ['Illustrator'],
    certifications: [],
    languages: [{ name: 'Serbian', level: 'Native' }],
    templateId,
    region: templateId === 'rirekisho' ? 'Japan' : 'Balkan',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  };
}

async function captureDocx(cv: CVData): Promise<string> {
  const blobs = new Map<string, Blob>();
  let saved: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      const url = `blob:http://simple-v1-m3/${blobs.size}`;
      blobs.set(url, blob);
      return url;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    saved = blobs.get(this.href) ?? null;
  });

  if (cv.templateId === 'rirekisho') {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => null),
    });
    await exportRirekishoToDOCX(cv, 'simple-v1-rirekisho');
  } else {
    await exportToDOCX(
      cv,
      'simple-v1-modern',
      cv.contentLocale ?? 'en',
      cv.templateId,
      { experiencePresentationReady: true },
    );
  }

  expect(saved).not.toBeNull();
  const zip = await JSZip.loadAsync(await saved!.arrayBuffer());
  return zip.file('word/document.xml')!.async('string');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Simple V1 M3 artifact content authority', () => {
  it('27. Modern Minimal PDF contains current Summary sentinel and excludes stale metadata', async () => {
    const snapshot = captureCvRenderSnapshot(fixture('modern-minimal'));
    const blob = await buildModernMinimalPdfBlob(snapshot.model, snapshot.contentLocale);
    const text = extractPdfUnicodeText(Buffer.from(await blob.arrayBuffer()))
      .replace(/\u0000/g, ' ')
      .replace(/\s+/g, ' ');
    expect(text).toContain(CURRENT);
    // The bundled PDF extraction font map drops the č glyph and inserts glyph
    // spacing; the remaining native Serbian role stem still proves the surface.
    expect(text.replace(/[^\p{L}]/gu, '')).toContain('Grafikadizajnerka');
    expect(text).not.toContain(STALE);
  }, 30_000);

  it('28. Modern Minimal DOCX contains current Summary sentinel and excludes stale metadata', async () => {
    const snapshot = captureCvRenderSnapshot(fixture('modern-minimal'));
    const xml = await captureDocx(snapshot.model);
    expect(xml).toContain(CURRENT);
    expect(xml).toContain('Grafička dizajnerka');
    expect(xml).not.toContain(STALE);
  }, 30_000);

  it('29. Rirekisho DOCX consumes the same current Summary authority', async () => {
    const snapshot = captureCvRenderSnapshot(fixture('rirekisho'));
    const xml = await captureDocx(snapshot.model);
    expect(xml).toContain(CURRENT);
    expect(xml).toContain('グラフィックデザイナー');
    expect(xml).not.toContain(STALE);
  }, 30_000);

  it.each([
    ['corporate-navy', 'en', 'Graphic Designer'],
    ['creative-artistic', 'ar', 'مصممة جرافيك'],
  ] as Array<[CVData['templateId'], Locale, string]>)('30. %s DOCX in %s preserves the current sentinel', async (templateId, contentLocale, roleTitle) => {
    const source = fixture(templateId);
    source.contentLocale = contentLocale;
    const snapshot = captureCvRenderSnapshot(source);
    const xml = await captureDocx(withCvRenderModelPhoto(snapshot, snapshot.model.personal.photo));
    expect(xml).toContain(CURRENT);
    expect(xml).toContain(roleTitle);
    expect(xml).not.toContain(STALE);
  }, 30_000);
});
