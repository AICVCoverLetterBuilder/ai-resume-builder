/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { render } from '@testing-library/react';
import { RirekishoTemplate } from '@/components/cv-templates';
import { buildRirekishoPdfBlob } from '@/lib/export';
import { clearPdfI18nFontCache } from '@/lib/pdf-i18n-text';
import type { CVData } from '@/lib/types';

type ExpectedGender = '男' | '女' | 'その他' | '';

function fixture(gender: string): CVData {
  return {
    id: `aab494-rirekisho-gender-${gender || 'empty'}`,
    name: 'AAB494 gender display',
    personal: {
      fullName: 'Ana Petrović', email: 'ana@example.com', phone: '', address: 'Beograd',
      jobTitle: 'Grafička dizajnerka', gender, photoEnabled: false,
    },
    summary: 'Sažetak.', contentLocale: 'sr', experience: [], education: [], skills: [],
    certifications: [], languages: [], templateId: 'rirekisho', region: 'Japan',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  } as CVData;
}

function installLocalFonts(): void {
  clearPdfI18nFontCache();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', String(input).split('/').pop() || '');
    if (!fs.existsSync(fontPath)) return { ok: false } as Response;
    const bytes = fs.readFileSync(fontPath);
    return {
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Response;
  });
}

async function extractPdfText(cv: CVData): Promise<string> {
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await (await buildRirekishoPdfBlob(cv, 'sr')).arrayBuffer()),
    disableFontFace: true,
  }).promise;
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const content = await pdf.getPage(index + 1).then((page) => page.getTextContent());
    return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
  }));
  return pages.join('\n');
}

function selectedMarker(container: HTMLElement, label: Exclude<ExpectedGender, ''>): boolean {
  const option = [...container.querySelectorAll('label')]
    .find((node) => node.textContent?.trim() === label);
  const marker = option?.querySelector('span');
  return Boolean(marker?.className.includes('bg-gray-900'));
}

beforeEach(installLocalFonts);
afterEach(() => {
  clearPdfI18nFontCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AAB494 Rirekisho structured gender display projection', () => {
  test.each([
    ['female', '女'],
    ['male', '男'],
    ['女', '女'],
    ['男', '男'],
    ['その他', 'その他'],
  ] as const)('renders %s as selected %s in the real Preview and direct PDF', async (storedGender, expected) => {
    const cv = fixture(storedGender);
    const preview = render(<RirekishoTemplate data={cv} />);
    for (const option of ['男', '女', 'その他'] as const) {
      expect.soft(selectedMarker(preview.container, option)).toBe(option === expected);
    }
    const extracted = await extractPdfText(cv);
    expect(extracted).toContain(expected);
    expect(extracted).not.toContain(storedGender === expected ? '__not-applicable__' : storedGender);
    expect(cv.personal.gender).toBe(storedGender);
  }, 30000);

  test('keeps an empty structured value unselected and blank without mutating storage', async () => {
    const cv = fixture('');
    const preview = render(<RirekishoTemplate data={cv} />);
    for (const option of ['男', '女', 'その他'] as const) {
      expect(selectedMarker(preview.container, option)).toBe(false);
    }
    await extractPdfText(cv);
    expect(cv.personal.gender).toBe('');
  }, 30000);
});
