/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModernMinimalTemplate, templateComponents } from '@/components/cv-templates';
import {
  CV_PDF_A4_HEIGHT_MM,
  CV_PDF_A4_WIDTH_MM,
  prepareModernMinimalImagesForExport,
  resolveExportImageDataUrl,
} from '@/lib/export';
import { exportToDOCX } from '@/lib/export';
import type { CVData } from '@/lib/types';

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'modern-minimal-test',
    name: '',
    personal: {
      fullName: 'Alexandra Very Long Candidate Name With Multiple Words',
      email: 'alexandra@example.com',
      phone: '+1 555 0100',
      address: 'San Francisco, CA',
      jobTitle: 'Senior Software Engineer',
      photo: 'data:image/png;base64,photo',
      photoEnabled: true,
    },
    summary: 'Full-stack engineer focused on accessible, scalable web applications.',
    experience: [
      {
        id: '1',
        company: 'Acme Corp',
        position: 'Senior Engineer',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: 'Built resilient systems.\n- Improved performance with careful profiling.',
      },
    ],
    education: [{ id: 'e1', school: 'State University', degree: 'BS Computer Science', startDate: '2014', endDate: '2018', description: '' }],
    skills: ['TypeScript', 'React', 'Node.js', 'Accessibility', 'PostgreSQL', 'Cloud Architecture'],
    certifications: ['AWS Certified Developer'],
    languages: [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Intermediate' }],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

const exportSource = () => fs.readFileSync(path.resolve('src/lib/export.ts'), 'utf8');
const templateSource = () => fs.readFileSync(path.resolve('src/components/cv-templates.tsx'), 'utf8');
const previewSource = () => fs.readFileSync(path.resolve('src/components/TemplatePreview.tsx'), 'utf8');
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 300;
  naturalHeight = 300;
  decode = vi.fn().mockResolvedValue(undefined);
  private currentSrc = '';

  get src() {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    setTimeout(() => {
      if (value.includes('broken')) this.onerror?.();
      else this.onload?.();
    }, 0);
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    beginPath: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(tinyPng);
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://test/docx'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Modern Minimal preview/export parity', () => {
  test('Modern Minimal resolves to the real renderer, not a static preview image or fallback', () => {
    expect(templateComponents['modern-minimal']).toBe(ModernMinimalTemplate);
    expect(previewSource()).toContain('const TemplateComponent = templateComponents[templateId]');
    expect(previewSource()).not.toContain('<img');
    expect(previewSource()).not.toContain('modern-minimal.png');
  });

  test('Modern Minimal HTML preview root is a border-box A4 capture target', () => {
    const html = renderToStaticMarkup(<ModernMinimalTemplate data={cv()} locale="en" />);
    const src = templateSource();
    const modernStart = src.indexOf('export function ModernMinimalTemplate');
    const modernEnd = src.indexOf('// --- Creative Bold');
    const modernSource = src.slice(modernStart, modernEnd);

    expect(html).toContain('data-template-id="modern-minimal"');
    expect(html).toContain('box-border');
    expect(html).toContain('w-[210mm]');
    expect(html).toContain('min-height:297mm');
    expect(modernSource).not.toContain('max-w-[210mm]');
  });

  test('Modern Minimal renders photo and no-photo variants without changing content', () => {
    const withPhoto = renderToStaticMarkup(<ModernMinimalTemplate data={cv({ personal: { photo: tinyPng } })} locale="en" />);
    const noPhoto = renderToStaticMarkup(<ModernMinimalTemplate data={cv({ personal: { photoEnabled: false } })} locale="en" />);

    expect(withPhoto).toContain('img');
    expect(withPhoto).toContain('Alexandra Very Long Candidate Name');
    expect(noPhoto).not.toContain('img');
    expect(noPhoto).toContain('Alexandra Very Long Candidate Name');
  });

  test('Modern Minimal PDF image preparation keeps data URL photos export-safe', async () => {
    document.body.innerHTML = `
      <div data-template-id="modern-minimal">
        <div style="width:110px;height:110px;border-radius:9999px;overflow:hidden">
          <img src="${tinyPng}#cache" alt="candidate photo" style="width:100%;height:100%;object-fit:cover" />
        </div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    const frame = img.parentElement as HTMLElement;
    const prepared = await prepareModernMinimalImagesForExport(root);

    expect(img.getAttribute('src')).toBe(tinyPng);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.style.objectFit).toBe('cover');
    expect(frame.style.display).not.toBe('none');

    prepared[0].img.setAttribute('alt', 'mutated');
    prepared[0].frame.style.display = 'none';
    prepared.forEach(entry => {
      if (entry.previousSrc === null) entry.img.removeAttribute('src');
      else entry.img.setAttribute('src', entry.previousSrc);
      if (entry.previousAlt === null) entry.img.removeAttribute('alt');
      else entry.img.setAttribute('alt', entry.previousAlt);
      entry.frame.style.display = entry.previousFrameDisplay;
    });
    expect(img.getAttribute('src')).toBe(`${tinyPng}#cache`);
    expect(img.getAttribute('alt')).toBe('candidate photo');
  });

  test('Modern Minimal blob photo is converted to a decoded data URL before PDF capture', async () => {
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) }));
    document.body.innerHTML = `
      <div data-template-id="modern-minimal">
        <div style="width:110px;height:110px;border-radius:9999px;overflow:hidden">
          <img src="blob:http://localhost/photo" alt="candidate photo" />
        </div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    await prepareModernMinimalImagesForExport(root);

    expect(fetch).toHaveBeenCalledWith('blob:http://localhost/photo');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(img.getAttribute('alt')).toBe('');
  });

  test('Modern Minimal broken photo source hides the photo frame instead of exporting alt text', async () => {
    document.body.innerHTML = `
      <div data-template-id="modern-minimal">
        <div style="width:110px;height:110px;border-radius:9999px;overflow:hidden">
          <img src="https://remote.example/broken-photo.png" alt="candidate photo" />
        </div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    const frame = img.parentElement as HTMLElement;
    await prepareModernMinimalImagesForExport(root);

    expect(img.hasAttribute('src')).toBe(false);
    expect(img.getAttribute('alt')).toBe('');
    expect(frame.style.display).toBe('none');
  });

  test('only Modern Minimal image preparation mutates image sources', async () => {
    document.body.innerHTML = `
      <div data-template-id="clean-simple">
        <div><img src="${tinyPng}#cache" alt="candidate photo" /></div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="clean-simple"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    const prepared = await prepareModernMinimalImagesForExport(root);

    expect(prepared).toEqual([]);
    expect(img.getAttribute('src')).toBe(`${tinyPng}#cache`);
    expect(img.getAttribute('alt')).toBe('candidate photo');
  });

  test('fetchable export images resolve to data URLs without enabling remote cross-origin loading', async () => {
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) }));

    await expect(resolveExportImageDataUrl('blob:http://localhost/photo')).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(resolveExportImageDataUrl('https://remote.example/photo.png')).resolves.toBeNull();
  });

  test('Modern Minimal skills and languages are separated in the preview renderer', () => {
    const html = renderToStaticMarkup(<ModernMinimalTemplate data={cv()} locale="en" />);

    expect(html).toContain('TypeScript');
    expect(html).toContain('React');
    expect(html).toContain('rounded bg-indigo-50');
    expect(html).toContain('English');
    expect(html).toContain('Native');
  });

  test('PDF export uses A4 dimensions and avoids custom short-page sizing', () => {
    const src = exportSource();

    expect(CV_PDF_A4_WIDTH_MM).toBe(210);
    expect(CV_PDF_A4_HEIGHT_MM).toBe(297);
    expect(src).toContain('format: \'a4\'');
    expect(src).toContain('PDF_TRAILING_SLICE_TOLERANCE_MM');
    expect(src).toContain('while (offsetY < canvasHeightPx - trailingTolerancePx)');
    expect(src).not.toContain('format: useSinglePage ? [PDF_WIDTH_MM');
  });

  test('Modern Minimal DOCX uses a dedicated layout before the generic single fallback', () => {
    const src = exportSource();
    const modernConfig = src.indexOf('customLayout: \'modern-minimal\'');
    const modernBranch = src.indexOf('cfg.customLayout === \'modern-minimal\'');
    const genericSingle = src.indexOf('cfg.layout === \'single\'');

    expect(modernConfig).toBeGreaterThan(0);
    expect(modernBranch).toBeGreaterThan(0);
    expect(modernBranch).toBeLessThan(genericSingle);
  });

  test('Modern Minimal DOCX contains template-specific layout markers and wrapped chip styling', () => {
    const src = exportSource();
    const branch = src.slice(src.indexOf('cfg.customLayout === \'modern-minimal\''), src.indexOf('cfg.layout === \'single\''));

    expect(branch).toContain('Modern Minimal DOCX mirrors the app preview');
    expect(branch).toContain('ImageRun');
    expect(branch).toContain('chipShade');
    expect(branch).toContain('getLocalizedCvSkillName');
    expect(branch).toContain('getLocalizedCvLanguageName');
    expect(branch).toContain('bidirectional: isRTL');
    expect(branch).toContain('mmDateRow');
  });

  test('Modern Minimal DOCX with photo contains media, relationship, drawing reference and text', async () => {
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/docx';
    });
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    await exportToDOCX(cv({ personal: { photo: tinyPng } }), 'modern-minimal-photo-test', 'en', 'modern-minimal');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Alexandra Very Long Candidate Name');
    expect(documentXml).toContain('Senior Engineer');
    expect(documentXml).toContain('TypeScript');
    expect(documentXml).toContain('<w:drawing>');
    expect(relsXml).toContain('image');
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  test('Modern Minimal DOCX without photo remains valid and non-empty', async () => {
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/docx';
    });
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = vi.fn();
      return el;
    });

    await exportToDOCX(cv({ personal: { photo: undefined, photoEnabled: false } }), 'modern-minimal-no-photo-test', 'en', 'modern-minimal');

    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Alexandra Very Long Candidate Name');
    expect(documentXml).toContain('Full-stack engineer');
    expect(mediaFiles).toHaveLength(0);
  });

  test('localized headings and RTL structure remain wired for Modern Minimal', () => {
    const arHtml = renderToStaticMarkup(<ModernMinimalTemplate data={cv()} locale="ar" />);
    const src = exportSource();

    expect(arHtml).toContain('data-template-id="modern-minimal"');
    expect(src).toContain('const isRTL = locale === \'ar\'');
    expect(src).toContain('mmHeading(t.cv.summary)');
    expect(src).toContain('mmHeading(t.cv.experience)');
    expect(src).toContain('mmHeading(t.cv.skills)');
    expect(src).toContain('mmHeading(t.cv.languages)');
  });

  test('AI Recommend source is not part of this Modern Minimal export change', () => {
    const changedFiles = fs.existsSync(path.resolve('.git'))
      ? execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
          .split(/\r?\n/)
          .filter(Boolean)
      : [];

    expect(changedFiles).not.toContain('src/lib/types.ts');
  });
});
