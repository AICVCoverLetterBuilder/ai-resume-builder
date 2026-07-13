// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  A4_MIN_HEIGHT_PX,
  A4_WIDTH_PX,
  analyzeCanvasPixels,
  applyOpaqueCaptureStyles,
  buildIframeSafeCss,
  createArabicCaptureIframe,
  forceCloneCaptureStyles,
  inlineStylesAreCaptureSafe,
  resolveArabicFontAbsoluteUrl,
  runUnsafeColorScanOrThrow,
  sanitizeClonedIframeDocument,
  scanDocumentForUnsafeColorFunctions,
  validateCaptureRootLayout,
} from '../cover-letter-arabic-pdf-capture';
import {
  beginArabicCoverLetterPdfExportTrace,
  formatArabicCoverLetterPdfDiagnosticReport,
  getArabicCoverLetterPdfMetrics,
  recordHtml2CanvasCause,
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

const SAMPLE_PNG =
  `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='.repeat(4)}`;

function filledCanvas(width = 1200, height = 1600) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#111827';
  ctx.font = '16px sans-serif';
  for (let y = 40; y < 300; y += 24) {
    ctx.fillText('Arabic export validation line content', 40, y);
  }
  canvas.toDataURL = () => SAMPLE_PNG;
  return canvas;
}

describe('Arabic cover letter PDF capture helpers', () => {
  test('applyOpaqueCaptureStyles sets opacity to 1 and fixed 0,0', () => {
    const el = document.createElement('div');
    el.style.opacity = '0.01';
    applyOpaqueCaptureStyles(el, 794, 1123);
    expect(el.style.opacity).toBe('1');
    expect(el.style.position).toBe('fixed');
    expect(el.style.top).toMatch(/^0(px)?$/);
    expect(el.style.left).toMatch(/^0(px)?$/);
    expect(el.style.transform).toBe('none');
  });

  test('forceCloneCaptureStyles restores opacity and strips foreign stylesheets', () => {
    const doc = document.implementation.createHTMLDocument('clone');
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/app.css';
    doc.head.appendChild(link);
    const rogue = doc.createElement('style');
    rogue.textContent = 'body{color:#000}';
    doc.head.appendChild(rogue);
    const safe = doc.createElement('style');
    safe.id = 'cl-arabic-pdf-capture-style';
    safe.textContent = 'body{color:#111111;background:#ffffff}';
    doc.head.appendChild(safe);
    const root = doc.createElement('div');
    root.id = 'cl-arabic-pdf-export-root';
    root.setAttribute('data-cl-arabic-export-root', 'true');
    root.className = 'scale-90';
    root.style.opacity = '0.01';
    doc.body.appendChild(root);
    forceCloneCaptureStyles(doc, '[data-cl-arabic-export-root="true"]');
    expect(doc.querySelectorAll('link[rel="stylesheet"]').length).toBe(0);
    expect(doc.querySelectorAll('style').length).toBe(1);
    expect(doc.getElementById('cl-arabic-pdf-capture-style')).toBeTruthy();
    expect(root.style.opacity).toBe('1');
    expect(root.getAttribute('class')).toBeNull();
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
    expect(analyzeCanvasPixels(canvas).ratio).toBeGreaterThan(0.01);
  });

  test('blank white canvas has near-zero non-white ratio', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);
    expect(analyzeCanvasPixels(canvas).ratio).toBeLessThan(0.001);
  });

  test('unsafe-color scanner detects oklch/lab/lch/color-mix', () => {
    const doc = document.implementation.createHTMLDocument('scan');
    const style = doc.createElement('style');
    style.textContent = 'body { color: oklch(0.7 0.1 200); }';
    doc.head.appendChild(style);
    expect(scanDocumentForUnsafeColorFunctions(doc).passed).toBe(false);
    expect(scanDocumentForUnsafeColorFunctions(doc).offender).toMatch(/oklch/i);

    const doc2 = document.implementation.createHTMLDocument('scan2');
    const el = doc2.createElement('div');
    el.setAttribute('style', 'background: color-mix(in srgb, red, blue)');
    doc2.body.appendChild(el);
    expect(scanDocumentForUnsafeColorFunctions(doc2).passed).toBe(false);
  });

  test('iframe safe CSS uses only hex/rgb and absolute font URL', () => {
    const url = 'https://example.test/fonts/NotoSansArabic-Regular.ttf';
    const css = buildIframeSafeCss(url);
    expect(css).toContain(url);
    expect(css).toContain("font-family: 'NotoSansArabicCapture'");
    expect(css).not.toMatch(/oklch|lab\(|lch\(|color-mix|var\(--/i);
    expect(inlineStylesAreCaptureSafe(css)).toBe(true);
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

  test('createArabicCaptureIframe builds a clean document without parent stylesheets', async () => {
    const parentStyle = document.createElement('style');
    parentStyle.textContent = 'body { color: oklch(0.65 0.2 40); }';
    document.head.appendChild(parentStyle);

    const ctx = await createArabicCaptureIframe(
      'Alex Carter',
      'السادة الكرام،\n\nأكتب للتقدم لشغل وظيفة مطوّر برمجيات في Google.\n\nمع خالص التحية،\nAlex Carter',
      'ar',
    );
    expect(ctx.root.ownerDocument).toBe(ctx.iframeDocument);
    expect(ctx.root.ownerDocument).not.toBe(document);
    expect(ctx.iframeDocument.querySelectorAll('link[rel="stylesheet"]').length).toBe(0);
    expect(ctx.iframeDocument.querySelectorAll('style').length).toBe(1);
    expect(ctx.iframeDocument.getElementById('cl-arabic-pdf-capture-style')).toBeTruthy();
    expect(ctx.iframeDocument.querySelectorAll('[class]').length).toBe(0);
    expect(scanDocumentForUnsafeColorFunctions(ctx.iframeDocument).passed).toBe(true);
    expect(resolveArabicFontAbsoluteUrl()).toMatch(/\/fonts\/NotoSansArabic-Regular\.ttf$/);
    expect(ctx.fontAbsoluteUrl).toBe(resolveArabicFontAbsoluteUrl());
    expect(ctx.iframeDocument.documentElement.outerHTML).not.toMatch(/oklch/i);

    ctx.iframe.remove();
    parentStyle.remove();
  });

  test('injected oklch in iframe fails pre-capture scan', async () => {
    const ctx = await createArabicCaptureIframe('Alex', 'مرحبا بالعالم العربي للاختبار.', 'ar');
    const rogue = ctx.iframeDocument.createElement('style');
    rogue.textContent = '#x { color: oklch(0.5 0.1 30); }';
    ctx.iframeDocument.head.appendChild(rogue);
    expect(() => runUnsafeColorScanOrThrow(ctx.iframeDocument)).toThrow(/oklch/i);
    const metrics = getArabicCoverLetterPdfMetrics();
    expect(metrics.unsafeColorFunctionScanResult).toMatch(/failed/);
    expect(metrics.unsafeColorOffender).toMatch(/oklch/i);
    ctx.iframe.remove();
  });
});

describe('Arabic PDF diagnostics preserve html2canvas cause', () => {
  beforeEach(() => {
    beginArabicCoverLetterPdfExportTrace();
  });

  test('recordHtml2CanvasCause stores original parser error', () => {
    const cause = new Error('Attempting to parse an unsupported color function "oklch"');
    recordHtml2CanvasCause(cause, {
      targetRect: '794x1123@0,0',
      targetStyles: 'opacity=1;transform=none',
    });
    const report = formatArabicCoverLetterPdfDiagnosticReport();
    expect(report).toContain('Attempting to parse an unsupported color function');
    expect(getArabicCoverLetterPdfMetrics().html2canvasCauseMessage).toContain('oklch');
  });
});

describe('Arabic cover letter PDF export integration (iframe)', () => {
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
    vi.doUnmock('../cover-letter-arabic-pdf-capture');
    vi.doUnmock('html2canvas');
    vi.doUnmock('jspdf');
    vi.resetModules();
    document.querySelectorAll('[data-cl-arabic-pdf-iframe]').forEach((el) => el.remove());
    document.querySelectorAll('[data-cl-arabic-pdf-overlay]').forEach((el) => el.remove());
    document.querySelectorAll('style').forEach((el) => {
      if ((el.textContent ?? '').includes('oklch')) el.remove();
    });
    document.getElementById('cl-preview')?.remove();
  });

  test('buildArabicCoverLetterPdfBlob captures iframe target despite parent oklch', async () => {
    const parentStyle = document.createElement('style');
    parentStyle.textContent = ':root { color: oklch(0.7 0.12 250); background: oklch(0.98 0.01 100); }';
    document.head.appendChild(parentStyle);

    const html2canvasMock = vi.fn(async (el: HTMLElement, opts?: Record<string, unknown>) => {
      expect(el.ownerDocument).not.toBe(document);
      expect(el.ownerDocument?.getElementById('cl-arabic-pdf-capture-style')).toBeTruthy();
      expect(el.ownerDocument?.querySelectorAll('link[rel="stylesheet"]').length).toBe(0);
      expect(el.ownerDocument?.documentElement.outerHTML).not.toMatch(/oklch/i);
      expect(opts?.foreignObjectRendering).toBe(false);
      expect(opts?.backgroundColor).toBe('#ffffff');
      expect(opts?.allowTaint).toBe(false);
      expect(opts?.windowWidth).toBe(opts?.width);
      expect(opts?.windowHeight).toBe(opts?.height);
      expect(opts).not.toHaveProperty('x');
      expect(typeof opts?.onclone).toBe('function');
      (opts?.onclone as (doc: Document) => void)(el.ownerDocument!);
      return filledCanvas();
    });

    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({
      jsPDF: vi.fn(() => ({
        addImage: vi.fn(),
        addPage: vi.fn(),
        output: vi.fn(() => new Blob([`%PDF-1.4 ${'0'.repeat(600)}`], { type: 'application/pdf' })),
      })),
    }));

    const {
      buildArabicCoverLetterPdfBlob,
      getArabicCoverLetterPdfDiagnostics,
      getArabicCoverLetterPdfMetrics,
    } = await import('../cover-letter-arabic-pdf');

    const blob = await buildArabicCoverLetterPdfBlob(
      'Alex Carter',
      'السادة الكرام،\n\nأكتب للتقدم لوظيفة مطوّر برمجيات في Google.\n\nمع خالص التحية،\nAlex Carter',
      'ar',
    );
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(100);
    expect(getArabicCoverLetterPdfMetrics().captureStrategy).toBe('isolated-iframe-primary');
    expect(getArabicCoverLetterPdfMetrics().targetOwnerDocument).toBe('iframe');
    expect(getArabicCoverLetterPdfMetrics().unsafeColorFunctionScanResult).toBe('passed');
    expect(getArabicCoverLetterPdfMetrics().iframeStylesheetLinkCount).toBe(0);
    expect(getArabicCoverLetterPdfMetrics().canvasWidth).toBe(1200);
    expect(getArabicCoverLetterPdfMetrics().nonWhitePixelRatio).toBeGreaterThan(0);
    expect(getArabicCoverLetterPdfMetrics().imageDataUrlLength).toBeGreaterThan(128);
    expect(getArabicCoverLetterPdfMetrics().pdfSignatureValid).toBe(true);
    const stages = getArabicCoverLetterPdfDiagnostics().map((d) => d.stage);
    expect(stages).toContain('iframe_created');
    expect(stages).toContain('iframe_document_written');
    expect(stages).toContain('unsafe_css_scan_completed');
    expect(stages).toContain('pdf_blob_validated');
    expect(stages.indexOf('iframe_cleanup_completed')).toBeGreaterThan(stages.indexOf('pdf_blob_validated'));
    expect(document.querySelector('[data-cl-arabic-pdf-iframe]')).toBeNull();
    expect(document.querySelector('[data-cl-arabic-pdf-overlay]')).toBeNull();
    parentStyle.remove();
  });

  test('Android uses iframe strategy and never the main document', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    mockCapacitor.getPlatform.mockReturnValue('android');

    const html2canvasMock = vi.fn(async (el: HTMLElement, opts?: Record<string, unknown>) => {
      expect(el.ownerDocument).not.toBe(window.document);
      expect(opts?.scale).toBe(1.5);
      return filledCanvas(800, 1100);
    });
    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({
      jsPDF: vi.fn(() => ({
        addImage: vi.fn(),
        addPage: vi.fn(),
        output: vi.fn(() => new Blob([`%PDF-1.4 ${'0'.repeat(600)}`], { type: 'application/pdf' })),
      })),
    }));

    const { buildArabicCoverLetterPdfBlob, getArabicCoverLetterPdfMetrics, resolveArabicPdfCaptureStrategy } =
      await import('../cover-letter-arabic-pdf');
    expect(resolveArabicPdfCaptureStrategy()).toBe('isolated-iframe-primary');
    await buildArabicCoverLetterPdfBlob(
      'Alex Carter',
      'السادة الكرام،\n\nأكتب للتقدم لشغل وظيفة مطوّر.\n\nمع خالص التحية،\nAlex Carter',
      'ar',
    );
    expect(getArabicCoverLetterPdfMetrics().captureStrategy).toBe('isolated-iframe-primary');
    expect(html2canvasMock).toHaveBeenCalledTimes(1);
  });

  test('pre-capture oklch in iframe blocks html2canvas', async () => {
    vi.resetModules();
    const html2canvasMock = vi.fn(async () => filledCanvas());
    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({ jsPDF: vi.fn() }));
    vi.doMock('../cover-letter-arabic-pdf-capture', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../cover-letter-arabic-pdf-capture')>();
      return {
        ...actual,
        createArabicCaptureIframe: async (...args: Parameters<typeof actual.createArabicCaptureIframe>) => {
          const ctx = await actual.createArabicCaptureIframe(...args);
          const rogue = ctx.iframeDocument.createElement('style');
          rogue.textContent = 'p { color: oklch(0.4 0.2 20); }';
          ctx.iframeDocument.head.appendChild(rogue);
          return ctx;
        },
      };
    });

    const { buildArabicCoverLetterPdfBlob } = await import('../cover-letter-arabic-pdf');
    await expect(
      buildArabicCoverLetterPdfBlob('Alex', 'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار.', 'ar'),
    ).rejects.toMatchObject({ code: 'unsafe_css' });
    expect(html2canvasMock).not.toHaveBeenCalled();
    expect(document.querySelector('[data-cl-arabic-pdf-iframe]')).toBeNull();
  });

  test('oklch html2canvas failure is not retried with the same document strategy', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    mockCapacitor.getPlatform.mockReturnValue('android');

    const html2canvasMock = vi
      .fn()
      .mockRejectedValue(new Error('Attempting to parse an unsupported color function "oklch"'));

    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({ jsPDF: vi.fn() }));

    const { buildArabicCoverLetterPdfBlob, getArabicCoverLetterPdfMetrics, formatArabicCoverLetterPdfDiagnosticReport } =
      await import('../cover-letter-arabic-pdf');

    await expect(
      buildArabicCoverLetterPdfBlob('Alex', 'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار.', 'ar'),
    ).rejects.toMatchObject({ code: 'html2canvas_error' });

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(getArabicCoverLetterPdfMetrics().html2canvasCauseMessage).toContain('oklch');
    expect(formatArabicCoverLetterPdfDiagnosticReport()).toContain('unsupported color function');
    expect(document.querySelector('[data-cl-arabic-pdf-iframe]')).toBeNull();
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

  test('onclone detecting oklch throws unsafe_cloned_css', async () => {
    const html2canvasMock = vi.fn(async (el: HTMLElement, opts?: Record<string, unknown>) => {
      const cloneDoc = document.implementation.createHTMLDocument('clone');
      const safe = cloneDoc.createElement('style');
      safe.id = 'cl-arabic-pdf-capture-style';
      safe.textContent = el.ownerDocument!.getElementById('cl-arabic-pdf-capture-style')?.textContent ?? '';
      safe.textContent += '\n#x { color: oklch(0.9 0.05 120); }';
      cloneDoc.head.appendChild(safe);
      const root = cloneDoc.createElement('div');
      root.id = 'cl-arabic-pdf-export-root';
      cloneDoc.body.appendChild(root);
      try {
        (opts?.onclone as (doc: Document) => void)(cloneDoc);
        throw new Error('expected onclone to throw');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).toMatch(/unsafe_cloned_css|oklch/i);
        throw Object.assign(new Error(message), { code: 'unsafe_cloned_css' });
      }
    });
    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({ jsPDF: vi.fn() }));

    const { buildArabicCoverLetterPdfBlob } = await import('../cover-letter-arabic-pdf');
    await expect(
      buildArabicCoverLetterPdfBlob('Alex', 'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار.', 'ar'),
    ).rejects.toMatchObject({ code: 'unsafe_cloned_css' });
  });
});

describe('sanitizeClonedIframeDocument', () => {
  test('throws unsafe_cloned_css when clone still contains oklch', () => {
    const doc = document.implementation.createHTMLDocument('bad-clone');
    const style = doc.createElement('style');
    style.id = 'cl-arabic-pdf-capture-style';
    style.textContent = 'body { color: oklch(0.5 0.1 10); }';
    doc.head.appendChild(style);
    expect(() => sanitizeClonedIframeDocument(doc)).toThrow(/unsafe_cloned_css|oklch/i);
  });
});
