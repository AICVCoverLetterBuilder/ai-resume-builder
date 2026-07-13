// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  analyzeCanvasPixels,
  applyOpaqueCaptureStyles,
  buildIsolatedArabicExportRoot,
  forceCloneCaptureStyles,
  inlineStylesAreCaptureSafe,
  validateCaptureRootLayout,
  A4_WIDTH_PX,
  A4_MIN_HEIGHT_PX,
} from '../cover-letter-arabic-pdf-capture';
import {
  formatArabicCoverLetterPdfDiagnosticReport,
  recordHtml2CanvasCause,
  beginArabicCoverLetterPdfExportTrace,
  getArabicCoverLetterPdfMetrics,
} from '../cover-letter-arabic-pdf-diagnostics';

const mockCapacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
  isPluginAvailable: vi.fn(() => true),
}));

const mockRegisterPlugin = vi.hoisted(() =>
  vi.fn(() => ({
    healthCheck: vi.fn(),
    saveFile: vi.fn(),
    print: vi.fn(),
  })),
);

vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor,
  registerPlugin: mockRegisterPlugin,
}));

describe('Arabic cover letter PDF capture helpers', () => {
  test('applyOpaqueCaptureStyles sets opacity to 1 and fixed 0,0', () => {
    const el = document.createElement('div');
    el.style.opacity = '0.01';
    applyOpaqueCaptureStyles(el, 794, 1123);
    expect(el.style.opacity).toBe('1');
    expect(el.style.visibility).toBe('visible');
    expect(el.style.display).toBe('block');
    expect(el.style.position).toBe('fixed');
    expect(el.style.top).toMatch(/^0(px)?$/);
    expect(el.style.left).toMatch(/^0(px)?$/);
    expect(el.style.width).toBe('794px');
    expect(el.style.height).toBe('1123px');
    expect(el.style.transform).toBe('none');
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

  test('isolated root has no Tailwind/app classes and only safe inline styles', () => {
    const { root } = buildIsolatedArabicExportRoot(
      'Alex Carter',
      'السادة الكرام،\n\nأكتب للتقدم لشغل وظيفة مطوّر برمجيات في Google.\n\nمع خالص التحية،\nAlex Carter',
      'ar',
    );
    expect(root.className).toBe('');
    expect(root.getAttribute('class')).toBeNull();
    expect(root.style.opacity).toBe('1');
    expect(root.style.position).toBe('fixed');
    expect(root.style.left).toMatch(/^0(px)?$/);
    expect(root.style.top).toMatch(/^0(px)?$/);
    expect(root.style.transform).toBe('none');
    const styleAttr = root.getAttribute('style') ?? '';
    expect(styleAttr).toMatch(/background:\s*(#ffffff|rgb\(255,\s*255,\s*255\))/i);
    expect(styleAttr).toMatch(/color:\s*(#111111|rgb\(17,\s*17,\s*17\))/i);
    expect(inlineStylesAreCaptureSafe(styleAttr)).toBe(true);
    expect(styleAttr).not.toMatch(/oklch|lab\(|lch\(|color-mix|var\(--/i);
    for (const child of Array.from(root.querySelectorAll('*'))) {
      expect(child.className).toBe('');
      expect(inlineStylesAreCaptureSafe((child as HTMLElement).getAttribute('style') ?? '')).toBe(true);
    }
  });

  test('negative bounding rect fails layout validation before capture', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    applyOpaqueCaptureStyles(el, A4_WIDTH_PX, A4_MIN_HEIGHT_PX);
    el.getBoundingClientRect = () =>
      ({
        x: -425,
        y: 0,
        width: 794,
        height: 1123,
        top: 0,
        left: -425,
        right: 369,
        bottom: 1123,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    Object.defineProperty(el, 'offsetWidth', { value: 794 });
    Object.defineProperty(el, 'offsetHeight', { value: 1123 });
    expect(() => validateCaptureRootLayout(el, A4_WIDTH_PX, A4_MIN_HEIGHT_PX)).toThrow(/negative bounding rect/);
    el.remove();
  });
});

describe('Arabic PDF diagnostics preserve html2canvas cause', () => {
  beforeEach(() => {
    beginArabicCoverLetterPdfExportTrace();
  });

  test('recordHtml2CanvasCause stores original parser error without wiping wrapper fields', () => {
    const cause = new Error('Attempting to parse an unsupported color function "oklch"');
    cause.name = 'Error';
    recordHtml2CanvasCause(cause, {
      targetRect: '794x1123@0,0',
      targetStyles: 'opacity=1;transform=none',
    });
    const metrics = getArabicCoverLetterPdfMetrics();
    expect(metrics.html2canvasCauseMessage).toContain('unsupported color function');
    expect(metrics.html2canvasCauseName).toBe('Error');
    const report = formatArabicCoverLetterPdfDiagnosticReport();
    expect(report).toContain('Attempting to parse an unsupported color function');
    expect(report).toContain('html2canvasCauseMessage:');
  });
});

describe('Arabic cover letter PDF export integration', () => {
  beforeEach(() => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);
    mockCapacitor.getPlatform.mockReturnValue('web');
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.querySelectorAll('[data-cl-arabic-export-root]').forEach((el) => el.remove());
    document.querySelectorAll('[data-cl-arabic-pdf-overlay]').forEach((el) => el.remove());
    document.getElementById('cl-preview')?.remove();
  });

  test('buildArabicCoverLetterPdfBlob returns validated PDF with isolated opaque capture', async () => {
    const html2canvasMock = vi.fn(async (el: HTMLElement, opts?: Record<string, unknown>) => {
      expect(el.getAttribute('data-cl-arabic-export-root')).toBe('true');
      expect(el.getAttribute('data-cl-arabic-isolated')).toBe('primary');
      expect(opts?.foreignObjectRendering).toBe(false);
      expect(opts?.backgroundColor).toBe('#ffffff');
      expect(opts?.scrollX).toBe(0);
      expect(opts?.scrollY).toBe(0);
      expect(typeof opts?.width).toBe('number');
      expect(typeof opts?.height).toBe('number');
      expect(opts).not.toHaveProperty('x');
      expect(opts).not.toHaveProperty('y');
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

    const {
      buildArabicCoverLetterPdfBlob,
      getArabicCoverLetterPdfDiagnostics,
      getArabicCoverLetterPdfMetrics,
    } = await import('../cover-letter-arabic-pdf');
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
    expect(getArabicCoverLetterPdfMetrics().captureStrategy).toBe('isolated-primary');
    expect(document.querySelector('[data-cl-arabic-export-root]')).toBeNull();
    expect(document.querySelector('[data-cl-arabic-pdf-overlay]')).toBeNull();
  });

  test('Android never uses preview-first even when preview exists', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    mockCapacitor.getPlatform.mockReturnValue('android');

    const preview = document.createElement('div');
    preview.id = 'cl-preview';
    preview.setAttribute('data-cl-arabic-preview', 'true');
    preview.textContent = 'معاينة عربية مع Tailwind zoom';
    preview.className = 'scale-90 transform translate-x-[-425px] bg-[oklch(0.7_0.1_200)]';
    preview.getBoundingClientRect = () =>
      ({
        x: -425,
        y: 0,
        width: 794,
        height: 592,
        top: 0,
        left: -425,
        right: 369,
        bottom: 592,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    document.body.appendChild(preview);

    const html2canvasMock = vi.fn(async (el: HTMLElement) => {
      expect(el.id).toBe('cl-arabic-pdf-export-root');
      expect(el.className).toBe('');
      expect(el.innerHTML).not.toContain('oklch');
      expect(el.getAttribute('data-cl-arabic-isolated')).toBe('primary');
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 1100);
      ctx.fillStyle = '#111111';
      ctx.fillRect(20, 20, 200, 40);
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

    const { buildArabicCoverLetterPdfBlob, getArabicCoverLetterPdfMetrics, resolveArabicPdfCaptureStrategy } =
      await import('../cover-letter-arabic-pdf');
    expect(resolveArabicPdfCaptureStrategy(true)).toBe('isolated-primary');

    await buildArabicCoverLetterPdfBlob(
      'Alex Carter',
      'السادة الكرام،\n\nأكتب للتقدم لشغل وظيفة مطوّر.\n\nمع خالص التحية،\nAlex Carter',
      'ar',
    );
    expect(getArabicCoverLetterPdfMetrics().captureStrategy).toBe('isolated-primary');
    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    const opts = html2canvasMock.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.scale).toBe(1.5);
    expect(opts.allowTaint).toBe(false);
    expect(opts.foreignObjectRendering).toBe(false);
  });

  test('html2canvas parser failure preserves exact cause and retries once', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    mockCapacitor.getPlatform.mockReturnValue('android');

    const html2canvasMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Attempting to parse an unsupported color function "oklch"'))
      .mockImplementationOnce(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1100;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 800, 1100);
        ctx.fillStyle = '#111111';
        ctx.fillRect(10, 10, 100, 30);
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

    const {
      buildArabicCoverLetterPdfBlob,
      getArabicCoverLetterPdfMetrics,
      formatArabicCoverLetterPdfDiagnosticReport,
      getArabicCoverLetterPdfDiagnostics,
    } = await import('../cover-letter-arabic-pdf');

    const blob = await buildArabicCoverLetterPdfBlob(
      'Alex',
      'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار والتحقق من التصدير.',
      'ar',
    );
    expect(blob.size).toBeGreaterThan(100);
    expect(html2canvasMock).toHaveBeenCalledTimes(2);
    expect(getArabicCoverLetterPdfMetrics().captureStrategy).toBe('isolated-simplified-retry');
    expect(getArabicCoverLetterPdfMetrics().html2canvasCauseMessage).toContain(
      'unsupported color function',
    );
    const report = formatArabicCoverLetterPdfDiagnosticReport();
    expect(report).toContain('Attempting to parse an unsupported color function');
    expect(getArabicCoverLetterPdfDiagnostics().some((d) => d.stage === 'html2canvas_retry_started')).toBe(
      true,
    );
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

  test('double html2canvas failure preserves both causes and cleans up', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    mockCapacitor.getPlatform.mockReturnValue('android');

    const html2canvasMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Attempting to parse an unsupported color function "oklch"'))
      .mockRejectedValueOnce(new Error('Canvas rendering context is not available'));

    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({ jsPDF: vi.fn() }));
    vi.doMock('../export', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../export')>();
      return { ...actual, ensureNotoFontsForHtmlCapture: vi.fn(async () => () => undefined) };
    });

    const {
      buildArabicCoverLetterPdfBlob,
      getArabicCoverLetterPdfMetrics,
      formatArabicCoverLetterPdfDiagnosticReport,
    } = await import('../cover-letter-arabic-pdf');

    await expect(
      buildArabicCoverLetterPdfBlob('Alex', 'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار.', 'ar'),
    ).rejects.toMatchObject({ code: 'html2canvas_error' });

    expect(html2canvasMock).toHaveBeenCalledTimes(2);
    const metrics = getArabicCoverLetterPdfMetrics();
    expect(metrics.html2canvasCauseMessage).toContain('unsupported color function');
    expect(metrics.html2canvasRetryCauseMessage).toContain('Canvas rendering context');
    const report = formatArabicCoverLetterPdfDiagnosticReport();
    expect(report).toContain('unsupported color function');
    expect(report).toContain('Canvas rendering context');
    expect(document.querySelector('[data-cl-arabic-export-root]')).toBeNull();
    expect(document.querySelector('[data-cl-arabic-pdf-overlay]')).toBeNull();
  });
});
