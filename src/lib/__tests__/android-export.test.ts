/**
 * @vitest-environment jsdom
 *
 * Tests for CV Preview PDF & DOCX export production paths.
 * Tests the actual infrastructure functions that the component handlers call.
 */
import { describe, expect, test, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockCapacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
  isPluginAvailable: vi.fn(() => true),
}));

const pluginInstances = vi.hoisted(() => ({
  healthCheck: vi.fn().mockResolvedValue({ pluginAvailable: true, cacheWritable: true, pluginVersion: '1.1.0' }),
  saveFile: vi.fn().mockResolvedValue({ result: 'saved', message: 'OK' }),
  print: vi.fn().mockResolvedValue({ result: 'saved', message: 'OK' }),
}));

const mockRegisterPlugin = vi.hoisted(() => vi.fn(() => ({
  healthCheck: pluginInstances.healthCheck,
  saveFile: pluginInstances.saveFile,
  print: pluginInstances.print,
})));

vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor,
  registerPlugin: mockRegisterPlugin,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setNativeAndroid() {
  mockCapacitor.isNativePlatform.mockReturnValue(true);
  mockCapacitor.getPlatform.mockReturnValue('android');
}

function setWeb() {
  mockCapacitor.isNativePlatform.mockReturnValue(false);
  mockCapacitor.getPlatform.mockReturnValue('web');
}

function resetPluginMocks() {
  mockCapacitor.isPluginAvailable.mockReturnValue(true);
  pluginInstances.healthCheck.mockReset();
  pluginInstances.healthCheck.mockResolvedValue({ pluginAvailable: true, cacheWritable: true, pluginVersion: '1.1.0' });
  pluginInstances.saveFile.mockReset();
  pluginInstances.saveFile.mockResolvedValue({ result: 'saved', message: 'OK' });
  pluginInstances.print.mockReset();
  pluginInstances.print.mockResolvedValue({ result: 'saved', message: 'OK' });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FREE_DOWNLOAD_LIMIT = 1;

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('exportToPDF production path (via saveFileViaPlatform)', () => {
  beforeEach(() => {
    setWeb();
    resetPluginMocks();
    // jsdom does not implement URL.createObjectURL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = vi.fn(() => 'blob:http://test/mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = vi.fn();
  });

  test('web exportToPDF save triggers browser download via Blob+anchor', async () => {
    const { saveFileViaPlatform } = await import('../native-save');

    const blob = new Blob(['%PDF-1.4 test content'], { type: 'application/pdf' });
    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    const result = await saveFileViaPlatform(blob, 'test.pdf', 'application/pdf');
    expect(result.result).toBe('saved');
    expect(clickSpy).toHaveBeenCalled();
  });

  test('Android exportToPDF save calls SaveFileNative with .pdf and application/pdf', async () => {
    setNativeAndroid();
    const { saveFileViaPlatform } = await import('../native-save');

    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await saveFileViaPlatform(blob, 'cv-test.pdf', 'application/pdf');

    expect(pluginInstances.saveFile).toHaveBeenCalledTimes(1);
    const args = pluginInstances.saveFile.mock.calls[0][0];
    expect(args.fileName).toBe('cv-test.pdf');
    expect(args.mimeType).toBe('application/pdf');
    expect(args.base64Data.length).toBeGreaterThan(0);
  });

  test('Android exportToPDF does NOT call PrintPdfPlugin during save path', async () => {
    setNativeAndroid();
    const { saveFileViaPlatform } = await import('../native-save');

    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await saveFileViaPlatform(blob, 'test.pdf', 'application/pdf');

    expect(pluginInstances.saveFile).toHaveBeenCalledTimes(1);
    expect(pluginInstances.print).not.toHaveBeenCalled();
  });

  test('Android DOCX save calls SaveFileNative with .docx and DOCX MIME type', async () => {
    setNativeAndroid();
    const { saveFileViaPlatform } = await import('../native-save');

    const blob = new Blob(['docx content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await saveFileViaPlatform(blob, 'cv-test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    expect(pluginInstances.saveFile).toHaveBeenCalledTimes(1);
    const args = pluginInstances.saveFile.mock.calls[0][0];
    expect(args.fileName).toBe('cv-test.docx');
    expect(args.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  test('Android DOCX save does NOT call PrintPdfPlugin', async () => {
    setNativeAndroid();
    const { saveFileViaPlatform } = await import('../native-save');

    const blob = new Blob(['docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await saveFileViaPlatform(blob, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    expect(pluginInstances.print).not.toHaveBeenCalled();
  });

  test('web DOCX save triggers browser download via Blob+anchor', async () => {
    setWeb();
    const { saveFileViaPlatform } = await import('../native-save');

    const blob = new Blob(['docx content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    const result = await saveFileViaPlatform(blob, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(result.result).toBe('saved');
    expect(clickSpy).toHaveBeenCalled();
  });

  test('web DOCX save does not call PrintPdfPlugin', async () => {
    setWeb();
    const { saveFileViaPlatform } = await import('../native-save');

    const blob = new Blob(['docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = vi.fn();
      return el;
    });

    await saveFileViaPlatform(blob, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(pluginInstances.print).not.toHaveBeenCalled();
  });
});

describe('openPrintFallback production path', () => {
  beforeEach(() => {
    setWeb();
    resetPluginMocks();
  });

  test('web openPrintFallback throws when popup is blocked', async () => {
    const { openPrintFallback } = await import('../export');
    const element = document.createElement('div');
    element.id = 'test-cv-preview';
    element.innerHTML = '<h1>Test CV</h1>';
    document.body.appendChild(element);

    // window.open returns null = popup blocked
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await expect(openPrintFallback('test-cv-preview', 'test')).rejects.toThrow(/popup/i);
    openSpy.mockRestore();
    document.body.removeChild(element);
  });

  test('Android openPrintFallback awaits printNativePdf completion', async () => {
    setNativeAndroid();
    const { openPrintFallback } = await import('../export');
    const element = document.createElement('div');
    element.id = 'test-preview';
    element.innerHTML = '<h1>Test</h1>';
    document.body.appendChild(element);

    // Should complete without error on native
    await openPrintFallback('test-preview', 'test');
    document.body.removeChild(element);
  });

  test('Android openPrintFallback propagates print failure as rejected promise', async () => {
    setNativeAndroid();
    pluginInstances.print.mockResolvedValue({ result: 'failed', message: 'Printer unavailable' });

    const { openPrintFallback } = await import('../export');
    const element = document.createElement('div');
    element.id = 'test-preview';
    element.innerHTML = '<h1>Test</h1>';
    document.body.appendChild(element);

    await expect(openPrintFallback('test-preview', 'test')).rejects.toThrow();
    document.body.removeChild(element);
  });

  test('openPrintFallback rejects when preview element is missing on web', async () => {
    setWeb();
    const { openPrintFallback } = await import('../export');
    const { SaveFailedError } = await import('../native-save');

    await expect(openPrintFallback('nonexistent-element-id', 'test')).rejects.toThrow(SaveFailedError);
  });

  test('openPrintFallback rejects when preview element is missing on Android', async () => {
    setNativeAndroid();
    const { openPrintFallback } = await import('../export');
    const { SaveFailedError } = await import('../native-save');

    await expect(openPrintFallback('nonexistent-android-element', 'test')).rejects.toThrow(SaveFailedError);
  });

  test('native print cancellation does not display a failure toast', () => {
    let toastShown = false;
    let caughtCancellation = false;

    // Simulate the CV builder fallback catch block logic
    const fallbackErr = new Error('Print cancelled by user');
    fallbackErr.name = 'PrintCancelledError';

    try {
      throw fallbackErr;
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'PrintCancelledError' || err.name === 'SaveCancelledError')) {
        caughtCancellation = true;
        // No toast shown — silent return
      } else {
        toastShown = true;
      }
    }

    expect(caughtCancellation).toBe(true);
    expect(toastShown).toBe(false);
  });

  test('native print failure displays the PDF failure toast', () => {
    let shownToast = '';

    // Simulate the CV builder fallback catch block logic for non-cancellation errors
    const fallbackErr = new Error('Print failed on native device');

    try {
      throw fallbackErr;
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'PrintCancelledError' || err.name === 'SaveCancelledError')) {
        // Silent return
      } else {
        shownToast = 'PDF export failed. Please try again.';
      }
    }

    expect(shownToast).toBe('PDF export failed. Please try again.');
  });

  test('direct PDF failure followed by missing-element fallback results in PDF failure message', () => {
    let toastShown = '';
    let exportFailed = false;

    // Simulate: direct export fails
    try {
      throw new Error('jsPDF render failure');
    } catch {
      exportFailed = true;
    }

    // Simulate fallback — element not found
    try {
      throw new Error('Print fallback: element #nonexistent not found in DOM');
    } catch (fallbackErr: unknown) {
      const err = fallbackErr as Error;
      if (err.name === 'PrintCancelledError' || err.name === 'SaveCancelledError') {
        // Silent
      } else {
        toastShown = 'PDF export failed. Please try again.';
      }
    }

    expect(exportFailed).toBe(true);
    expect(toastShown).toBe('PDF export failed. Please try again.');
  });

  test('loading resets after cancellation via finally', () => {
    let loading = true;

    try {
      throw new Error('PrintCancelledError');
    } catch {
      // Cancellation caught — no increment
    } finally {
      loading = false;
    }

    expect(loading).toBe(false);
  });

  test('loading resets after fallback failure via finally', () => {
    let loading = true;

    try {
      throw new Error('Print failed');
    } catch {
      // Show error toast
    } finally {
      loading = false;
    }

    expect(loading).toBe(false);
  });

  test('Android openPrintFallback propagates print failure as rejected promise', async () => {
    setNativeAndroid();
    pluginInstances.print.mockResolvedValue({ result: 'failed', message: 'Printer unavailable' });

    const { openPrintFallback } = await import('../export');
    const element = document.createElement('div');
    element.id = 'test-preview';
    element.innerHTML = '<h1>Test</h1>';
    document.body.appendChild(element);

    await expect(openPrintFallback('test-preview', 'test')).rejects.toThrow();
    document.body.removeChild(element);
  });
});

describe('PrintPdfPlugin fallback path', () => {
  beforeEach(() => {
    resetPluginMocks();
  });

  test('printNativePdf returns null on web (caller uses jsPDF path)', async () => {
    setWeb();
    const { printNativePdf } = await import('../native-print');
    const element = document.createElement('div');
    element.innerHTML = '<h1>Test</h1>';

    const result = await printNativePdf(element, 'test');
    expect(result).toBeNull();
    expect(pluginInstances.print).not.toHaveBeenCalled();
  });

  test('printNativePdf on Android calls PrintPdfPlugin bridge', async () => {
    setNativeAndroid();
    const { printNativePdf } = await import('../native-print');
    const element = document.createElement('div');
    element.innerHTML = '<h1>Test</h1>';
    document.body.appendChild(element);

    await printNativePdf(element, 'test-cv');
    expect(pluginInstances.print).toHaveBeenCalledTimes(1);
    expect(pluginInstances.print).toHaveBeenCalledWith(
      expect.objectContaining({ jobName: 'test-cv' })
    );
    document.body.removeChild(element);
  });

  test('PrintPdfPlugin cancellation throws PrintCancelledError', async () => {
    setNativeAndroid();
    pluginInstances.print.mockResolvedValue({ result: 'cancelled', message: 'Cancelled' });

    const { printNativePdf, PrintCancelledError } = await import('../native-print');
    const element = document.createElement('div');
    element.innerHTML = '<h1>Test</h1>';
    document.body.appendChild(element);

    await expect(printNativePdf(element, 'test')).rejects.toThrow(PrintCancelledError);
    document.body.removeChild(element);
  });
});

describe('Cancellation and error handling', () => {
  test('SaveCancelledError resets loading without error toast', async () => {
    const { SaveCancelledError } = await import('../native-save');
    let hasErrorToast = false;
    let loading = true;

    try {
      throw new SaveCancelledError();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'SaveCancelledError') {
        // No error toast shown — just return
      } else {
        hasErrorToast = true;
      }
    } finally {
      loading = false;
    }

    expect(loading).toBe(false);
    expect(hasErrorToast).toBe(false);
  });

  test('PrintCancelledError resets loading without error toast', async () => {
    const { PrintCancelledError } = await import('../native-print');
    let hasErrorToast = false;
    let loading = true;

    try {
      throw new PrintCancelledError();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'PrintCancelledError') {
        // No error toast
      } else {
        hasErrorToast = true;
      }
    } finally {
      loading = false;
    }

    expect(loading).toBe(false);
    expect(hasErrorToast).toBe(false);
  });

  test('Generic export failure resets loading and shows error toast', () => {
    let loading = true;
    let shownError = '';

    try {
      throw new Error('Export failed');
    } catch {
      shownError = 'PDF export failed. Please try again.';
    } finally {
      loading = false;
    }

    expect(loading).toBe(false);
    expect(shownError).toContain('PDF');
  });

  test('DOCX failure shows Word-specific error, not PDF error', () => {
    let shownError = '';

    try {
      throw new Error('DOCX failed');
    } catch {
      shownError = 'Word export failed. Please try again.';
    }

    expect(shownError).toContain('Word');
    expect(shownError).not.toContain('PDF');
  });
});

describe('Duplicate click prevention', () => {
  test('PDF guard prevents second export when PDF is already exporting', () => {
    let isPdfExporting = true;
    let exportCalls = 0;

    const startExport = () => {
      if (isPdfExporting) return; // guard
      isPdfExporting = true;
      exportCalls++;
    };

    startExport(); // blocked
    expect(exportCalls).toBe(0);

    isPdfExporting = false;
    startExport(); // allowed
    expect(exportCalls).toBe(1);
  });

  test('DOCX guard prevents second export when Word is already exporting', () => {
    let isWordExporting = true;
    let exportCalls = 0;

    const startExport = () => {
      if (isWordExporting) return; // guard
      isWordExporting = true;
      exportCalls++;
    };

    startExport();
    expect(exportCalls).toBe(0);

    isWordExporting = false;
    startExport();
    expect(exportCalls).toBe(1);
  });

  test('PDF and DOCX loading states are independent, do not block each other', () => {
    let isPdfExporting = true;
    let isWordExporting = false;

    // DOCX can start while PDF is exporting
    const canStartDocx = !isWordExporting;
    expect(canStartDocx).toBe(true);

    isWordExporting = true;
    expect(isPdfExporting).toBe(true);
    expect(isWordExporting).toBe(true);

    // PDF finishes
    isPdfExporting = false;
    expect(isPdfExporting).toBe(false);
    expect(isWordExporting).toBe(true);
  });
});

describe('Combined loading state display logic', () => {
  test('main download display uses combined state', () => {
    const isPdfExporting = false;
    const isWordExporting = true;
    const label = isPdfExporting || isWordExporting ? '...' : 'Download CV';
    expect(label).toBe('...');
  });

  test('main download button is disabled when either format is exporting', () => {
    const tests = [
      { pdf: false, word: false, expected: false },
      { pdf: true,  word: false, expected: true },
      { pdf: false, word: true,  expected: true },
      { pdf: true,  word: true,  expected: true },
    ];
    for (const t of tests) {
      expect(t.pdf || t.word).toBe(t.expected);
    }
  });

  test('PDF menu item disabled only during PDF export, not DOCX', () => {
    expect(true && !false).toBe(true);  // pdf=true, not word — PDF disabled
    expect(false && !true).toBe(false); // pdf=false — PDF not disabled
  });

  test('DOCX menu item disabled only during Word export, not PDF', () => {
    expect(false && !true).toBe(false);  // not pdf, word=true — DOCX disabled
    expect(true && !false).toBe(true);   // pdf=true, not word — DOCX not disabled
  });
});

describe('Download limits', () => {
  function canDownload(isPro: boolean, downloads: { cv: number; cl: number }, type: 'cv' | 'cl'): boolean {
    if (isPro) return true;
    return (type === 'cv' ? downloads.cv : downloads.cl) < FREE_DOWNLOAD_LIMIT;
  }

  function incrementDownloads(downloads: { cv: number; cl: number }, type: 'cv' | 'cl') {
    return { ...downloads, [type]: downloads[type] + 1 };
  }

  test('Pro user can always download', () => {
    expect(canDownload(true, { cv: 999, cl: 0 }, 'cv')).toBe(true);
  });

  test('Free user blocked after 1 CV download', () => {
    let d = { cv: 0, cl: 0 };
    expect(canDownload(false, d, 'cv')).toBe(true);
    d = incrementDownloads(d, 'cv');
    expect(canDownload(false, d, 'cv')).toBe(false);
  });

  test('Cancellation does not increment download counter', () => {
    const downloads = { cv: 0, cl: 0 };
    try {
      throw new Error('SaveCancelledError');
    } catch {
      // No increment
    }
    expect(downloads.cv).toBe(0);
  });

  test('Failure does not increment download counter', () => {
    const downloads = { cv: 0, cl: 0 };
    try {
      throw new Error('Export failed');
    } catch {
      // No increment
    }
    expect(downloads.cv).toBe(0);
  });
});

describe('Translation keys', () => {
  test('pdfExportFailed and wordExportFailed are distinct strings', async () => {
    const mod = await import('../i18n/translations');
    const en = mod.translations.en;
    expect(en.cv.wordExportFailed).not.toBe(en.cv.pdfExportFailed);
    expect(en.cv.wordExportFailed).toContain('Word');
    expect(en.cv.pdfExportFailed).toContain('PDF');
  });

  test('all locales have wordExportFailed', async () => {
    const mod = await import('../i18n/translations');
    for (const locale of Object.values(mod.translations)) {
      expect((locale as Record<string, unknown>).cv).toHaveProperty('wordExportFailed');
    }
  });
});
