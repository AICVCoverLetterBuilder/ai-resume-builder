// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  analyzeCanvasPixels,
  applyOpaqueCaptureStyles,
  forceCloneCaptureStyles,
} from '../cover-letter-arabic-pdf-capture';

describe('Arabic cover letter PDF capture helpers', () => {
  test('applyOpaqueCaptureStyles sets opacity to 1', () => {
    const el = document.createElement('div');
    el.style.opacity = '0.01';
    applyOpaqueCaptureStyles(el, 794, 1123);
    expect(el.style.opacity).toBe('1');
    expect(el.style.visibility).toBe('visible');
    expect(el.style.display).toBe('block');
    expect(el.style.width).toBe('794px');
    expect(el.style.height).toBe('1123px');
  });

  test('forceCloneCaptureStyles restores opacity on cloned ancestors', () => {
    const doc = document.implementation.createHTMLDocument('clone');
    const parent = doc.createElement('div');
    parent.style.opacity = '0.01';
    const root = doc.createElement('div');
    root.setAttribute('data-cl-arabic-export-root', 'true');
    root.style.opacity = '0.01';
    parent.appendChild(root);
    doc.body.appendChild(parent);
    forceCloneCaptureStyles(doc, '[data-cl-arabic-export-root="true"]');
    expect(root.style.opacity).toBe('1');
    expect(parent.style.opacity).toBe('1');
  });

  test('analyzeCanvasPixels detects non-white content', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#000000';
    ctx.fillRect(10, 10, 80, 20);
    const analysis = analyzeCanvasPixels(canvas);
    expect(analysis.ratio).toBeGreaterThan(0.01);
  });

  test('blank white canvas has near-zero non-white ratio', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);
    const analysis = analyzeCanvasPixels(canvas);
    expect(analysis.ratio).toBeLessThan(0.001);
  });
});

describe('Arabic cover letter PDF export integration', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.querySelectorAll('[data-cl-arabic-pdf-mount]').forEach((el) => el.remove());
    document.querySelectorAll('[data-cl-arabic-pdf-overlay]').forEach((el) => el.remove());
  });

  test('buildArabicCoverLetterPdfBlob returns validated PDF with opaque capture', async () => {
    const html2canvasMock = vi.fn(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1200, 1600);
      ctx.fillStyle = '#111827';
      ctx.font = '16px sans-serif';
      for (let y = 40; y < 300; y += 24) {
        ctx.fillText('Arabic export validation line content', 40, y);
      }
      canvas.toDataURL = () =>
        `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='.repeat(4)}`;
      return canvas;
    });

    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({
      jsPDF: vi.fn(() => ({
        addImage: vi.fn(),
        addPage: vi.fn(),
        output: vi.fn(() => new Blob([`%PDF-1.4 ${'0'.repeat(600)}`], { type: 'application/pdf' })),
      })),
    }));
    vi.doMock('../export', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../export')>();
      return { ...actual, ensureNotoFontsForHtmlCapture: vi.fn(async () => () => undefined) };
    });

    const { buildArabicCoverLetterPdfBlob, getArabicCoverLetterPdfDiagnostics } = await import(
      '../cover-letter-arabic-pdf'
    );
    const content =
      'أليكس كارتر\n\n12 يوليو 2026\n\nالسادة الكرام،\n\nأكتب للتقدم لوظيفة مطوّر برمجيات في Google.\n\nمع خالص التحية،\nAlex Carter';

    const blob = await buildArabicCoverLetterPdfBlob('Alex Carter', content, 'ar');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(100);

    const stages = getArabicCoverLetterPdfDiagnostics().map((d) => d.stage);
    expect(stages).toContain('export_root_attached');
    expect(stages).toContain('canvas_pixel_validation_completed');
    expect(stages).toContain('pdf_blob_validated');
    expect(stages.indexOf('cleanup_completed')).toBeGreaterThan(stages.indexOf('pdf_blob_validated'));

    const captureTarget = html2canvasMock.mock.calls[0][0] as HTMLElement;
    expect(getComputedStyle(captureTarget).opacity).toBe('1');
  });

  test('blank canvas throws blank_canvas error', async () => {
    vi.doMock('html2canvas', () => ({
      default: vi.fn(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 400);
        canvas.toDataURL = () => 'data:image/png;base64,abc';
        return canvas;
      }),
    }));
    vi.doMock('jspdf', () => ({ jsPDF: vi.fn() }));
    vi.doMock('../export', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../export')>();
      return { ...actual, ensureNotoFontsForHtmlCapture: vi.fn(async () => () => undefined) };
    });

    const { buildArabicCoverLetterPdfBlob, CoverLetterArabicPdfExportError } = await import(
      '../cover-letter-arabic-pdf'
    );
    await expect(
      buildArabicCoverLetterPdfBlob('Alex', 'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار والتحقق.', 'ar'),
    ).rejects.toMatchObject({ code: 'blank_canvas' });
    await expect(
      buildArabicCoverLetterPdfBlob('Alex', 'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار والتحقق.', 'ar'),
    ).rejects.toBeInstanceOf(CoverLetterArabicPdfExportError);
  });
});
