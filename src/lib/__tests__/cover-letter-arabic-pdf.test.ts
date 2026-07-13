// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

describe('Arabic cover letter PDF Android-safe capture', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.querySelectorAll('[data-cl-arabic-pdf-wrapper]').forEach((el) => el.remove());
  });

  test('buildArabicCoverLetterPdfBlob attaches measurable container and returns non-empty PDF blob', async () => {
    const html2canvasMock = vi.fn(async () => {
      const canvas = document.createElement('canvas');
      Object.defineProperty(canvas, 'width', { value: 1588 });
      Object.defineProperty(canvas, 'height', { value: 2246 });
      canvas.getContext = () =>
        ({
          getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
        }) as unknown as CanvasRenderingContext2D;
      canvas.toDataURL = () => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';
      return canvas;
    });

    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
    vi.doMock('jspdf', () => ({
      jsPDF: vi.fn(() => ({
        addImage: vi.fn(),
        addPage: vi.fn(),
        output: vi.fn(() => new Blob([`%PDF-1.4 ${'0'.repeat(520)}`], { type: 'application/pdf' })),
      })),
    }));
    vi.doMock('../export', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../export')>();
      return {
        ...actual,
        ensureNotoFontsForHtmlCapture: vi.fn(async () => () => undefined),
      };
    });

    const { buildArabicCoverLetterPdfBlob, getArabicCoverLetterPdfDiagnostics } = await import(
      '../cover-letter-arabic-pdf'
    );

    const content =
      'أليكس كارتر\n\n12 يوليو 2026\n\nالسادة الكرام،\n\nأكتب للتقدم لوظيفة مطوّر برمجيات في Google.\n\nساعدت الفريق في المهام اليومية.\n\nأقدر التزام الشركة.\n\nأتطلع إلى فرصة لمناقشة كيف يمكنني إضافة قيمة حقيقية لفريقكم.\n\nمع خالص التحية،\nAlex Carter';

    const blob = await buildArabicCoverLetterPdfBlob('Alex Carter', content, 'ar');
    expect(blob.size).toBeGreaterThan(100);
    expect(blob.type).toBe('application/pdf');

    const stages = getArabicCoverLetterPdfDiagnostics().map((d) => d.stage);
    expect(stages).toContain('container_attached');
    expect(stages).toContain('container_measured');
    expect(stages).toContain('html2canvas_completed');
    expect(stages).toContain('blob_validated');
    expect(stages.indexOf('cleanup_completed')).toBeGreaterThan(stages.indexOf('blob_validated'));

    expect(html2canvasMock).toHaveBeenCalled();
    const captureTarget = html2canvasMock.mock.calls[0][0] as HTMLElement;
    expect(captureTarget.getAttribute('data-cl-arabic-pdf')).toBe('true');
    expect(captureTarget.getAttribute('dir')).toBe('rtl');
    expect(document.querySelector('[data-cl-arabic-pdf-wrapper]')).toBeNull();
  });

  test('html2canvas failure surfaces export-specific error with stage', async () => {
    vi.doMock('html2canvas', () => ({
      default: vi.fn(async () => {
        throw new Error('clone failed');
      }),
    }));
    vi.doMock('jspdf', () => ({ jsPDF: vi.fn() }));
    vi.doMock('../export', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../export')>();
      return {
        ...actual,
        ensureNotoFontsForHtmlCapture: vi.fn(async () => () => undefined),
      };
    });

    const { buildArabicCoverLetterPdfBlob, CoverLetterArabicPdfExportError } = await import(
      '../cover-letter-arabic-pdf'
    );

    await expect(
      buildArabicCoverLetterPdfBlob(
        'Alex',
        'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار والتحقق من المحتوى العربي.',
        'ar',
      ),
    ).rejects.toBeInstanceOf(CoverLetterArabicPdfExportError);
  });

  test('cleanup happens only after capture completes', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(HTMLElement.prototype, 'remove');

    vi.doMock('html2canvas', () => ({
      default: vi.fn(async (target: HTMLElement) => {
        expect(document.body.contains(target.closest('[data-cl-arabic-pdf-wrapper]')!)).toBe(true);
        const canvas = document.createElement('canvas');
        Object.defineProperty(canvas, 'width', { value: 1200 });
        Object.defineProperty(canvas, 'height', { value: 1600 });
        canvas.toDataURL = () => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';
        return canvas;
      }),
    }));
    vi.doMock('jspdf', () => ({
      jsPDF: vi.fn(() => ({
        addImage: vi.fn(),
        output: vi.fn(() => new Blob([`%PDF-1.4 ${'0'.repeat(520)}`], { type: 'application/pdf' })),
      })),
    }));
    vi.doMock('../export', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../export')>();
      return {
        ...actual,
        ensureNotoFontsForHtmlCapture: vi.fn(async () => () => undefined),
      };
    });

    const { buildArabicCoverLetterPdfBlob } = await import('../cover-letter-arabic-pdf');
    await buildArabicCoverLetterPdfBlob(
      'Alex',
      'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار والتحقق من المحتوى العربي.',
      'ar',
    );

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
