import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

describe('Arabic cover letter PDF export path', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => null),
      fonts: { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() },
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => ({
        setAttribute: vi.fn(),
        style: {},
        textContent: '',
        appendChild: vi.fn(),
        remove: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test('buildArabicCoverLetterPdfBlob throws outside browser', async () => {
    vi.stubGlobal('document', undefined);
    const { buildArabicCoverLetterPdfBlob } = await import('../cover-letter-arabic-pdf');
    await expect(
      buildArabicCoverLetterPdfBlob('Alex', 'مرحبا بكم في هذه الرسالة الطويلة بما يكفي للاختبار.', 'ar'),
    ).rejects.toThrow(/browser environment/i);
  });

  test('exportCoverLetterToPDF routes Arabic locale to HTML capture path', async () => {
    const captureSpy = vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    vi.doMock('../cover-letter-arabic-pdf', () => ({
      buildArabicCoverLetterPdfBlob: captureSpy,
    }));

    const saveSpy = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../export-save', () => ({ saveBlobWithPicker: saveSpy }));

    const { exportCoverLetterToPDF } = await import('../export');
    const content =
      'أليكس كارتر\n\n12 يوليو 2026\n\nالسادة الكرام،\n\nأكتب للتقدم لوظيفة بائع. لدي خبرة في Google CRM وخدمة العملاء.\n\nساعدت العملاء في المتجر.\n\nأقدر التزام الشركة.\n\nشكرًا.\n\nمع خالص التحية،\nأليكس كارتر';

    await exportCoverLetterToPDF('Alex Carter', content, 'cover-letter', 'ar', 'Acme');

    expect(captureSpy).toHaveBeenCalledWith('Alex Carter', expect.any(String), 'ar');
  });
});
