import { describe, expect, test } from 'vitest';
import {
  createCoverLetterRequestId,
  isCoverLetterContentCurrent,
  isCoverLetterDownloadAllowed,
  normalizeCoverLetterGroundingStatus,
  shouldApplyCoverLetterGenerationResult,
  type ActiveCoverLetterRequest,
} from '../cover-letter-flow';
import { contentMatchesRequestedLocale } from '../cover-letter-generation';

const HINDI_SAMPLE =
  'अलेक्स कार्टर\n\n12 जुलाई 2026\n\nप्रिय टीम,\n\nमैं सेल्समैन पद के लिए आवेदन कर रहा हूँ। मेरे पास ग्राहक सेवा का अनुभव है।\n\nमैंने दुकान में ग्राहकों की सहायता की है और उत्पादों की जानकारी दी है।\n\nकंपनी की सेवा मुझे प्रेरित करती है और मैं टीम में योगदान देना चाहता हूँ।\n\nधन्यवाद।\n\nसादर,\nअलेक्स कार्टर';

const ARABIC_SAMPLE =
  'أليكس كارتر\n\n12 يوليو 2026\n\nالسادة الكرام،\n\nأكتب للتقدم لوظيفة بائع في شركتكم. لدي خبرة في خدمة العملاء والمساعدة في المتجر.\n\nساعدت العملاء في اختيار المنتجات وتقديم المعلومات اللازمة بشكل واضح.\n\nأقدر التزام شركتكم بالجودة وأتطلع للمساهمة مع الفريق.\n\nشكرًا لوقتكم.\n\nمع خالص التحية،\nأليكس كارتر';

describe('cover letter generation flow guards', () => {
  test('createCoverLetterRequestId returns unique non-empty ids', () => {
    const a = createCoverLetterRequestId();
    const b = createCoverLetterRequestId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  test('shouldApplyCoverLetterGenerationResult accepts only matching request id, locale, and gender', () => {
    const active: ActiveCoverLetterRequest = { requestId: 'req-1', locale: 'ar', gender: 'female' };
    expect(shouldApplyCoverLetterGenerationResult(active, 'req-1', 'ar', 'female')).toBe(true);
    expect(shouldApplyCoverLetterGenerationResult(active, 'req-2', 'ar', 'female')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(active, 'req-1', 'hi', 'female')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(active, 'req-1', 'ar', 'male')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(null, 'req-1', 'ar', 'female')).toBe(false);
  });

  test('stale Hindi content is not current when Arabic is selected', () => {
    expect(
      isCoverLetterContentCurrent(HINDI_SAMPLE, 'hi', 'ar', 'idle', 'passed'),
    ).toBe(false);
    expect(
      isCoverLetterDownloadAllowed(HINDI_SAMPLE, 'hi', 'ar', 'idle', 'passed'),
    ).toBe(false);
  });

  test('loading phase hides preview and blocks downloads even when locale matches', () => {
    expect(
      isCoverLetterContentCurrent(ARABIC_SAMPLE, 'ar', 'ar', 'loading', 'passed'),
    ).toBe(false);
    expect(
      isCoverLetterDownloadAllowed(ARABIC_SAMPLE, 'ar', 'ar', 'loading', 'passed'),
    ).toBe(false);
  });

  test('Arabic content is current only after successful generation for Arabic locale', () => {
    expect(
      isCoverLetterContentCurrent(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'passed'),
    ).toBe(true);
    expect(
      isCoverLetterDownloadAllowed(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'passed'),
    ).toBe(true);
  });

  test('wrong-language Arabic body is rejected when Hindi was requested', () => {
    expect(contentMatchesRequestedLocale(ARABIC_SAMPLE, 'hi')).toBe(false);
    expect(
      isCoverLetterContentCurrent(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'passed'),
    ).toBe(true);
    expect(
      isCoverLetterContentCurrent(ARABIC_SAMPLE, 'ar', 'hi', 'success', 'passed'),
    ).toBe(false);
  });

  test('race: late Hindi response must not apply after Arabic request started', () => {
    const arabicActive: ActiveCoverLetterRequest = { requestId: 'arabic-req', locale: 'ar', gender: 'unspecified' };
    const hindiResponseId = 'hindi-req';
    expect(shouldApplyCoverLetterGenerationResult(arabicActive, hindiResponseId, 'hi', 'unspecified')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(arabicActive, 'arabic-req', 'ar', 'unspecified')).toBe(true);
  });

  test('stale Arabic response cannot overwrite newer request in another language', () => {
    const englishActive: ActiveCoverLetterRequest = { requestId: 'en-req-2', locale: 'en', gender: 'unspecified' };
    expect(shouldApplyCoverLetterGenerationResult(englishActive, 'ar-req-1', 'ar', 'unspecified')).toBe(false);
  });

  test('gender-switch race: late male response must not overwrite female request', () => {
    const femaleActive: ActiveCoverLetterRequest = { requestId: 'female-req', locale: 'hi', gender: 'female' };
    expect(shouldApplyCoverLetterGenerationResult(femaleActive, 'male-req', 'hi', 'male')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(femaleActive, 'female-req', 'hi', 'male')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(femaleActive, 'female-req', 'hi', 'female')).toBe(true);
  });

  test('failed grounding blocks downloads even when locale matches', () => {
    expect(
      isCoverLetterDownloadAllowed(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'failed'),
    ).toBe(false);
    expect(
      isCoverLetterDownloadAllowed(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'passed'),
    ).toBe(true);
    expect(
      isCoverLetterDownloadAllowed(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'fallback'),
    ).toBe(true);
  });

  test('missing groundingStatus is rejected for preview and export', () => {
    expect(
      isCoverLetterContentCurrent(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'missing'),
    ).toBe(false);
    expect(
      isCoverLetterDownloadAllowed(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'missing'),
    ).toBe(false);
  });

  test('unknown groundingStatus is rejected', () => {
    expect(
      isCoverLetterContentCurrent(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'unknown'),
    ).toBe(false);
    expect(
      isCoverLetterDownloadAllowed(ARABIC_SAMPLE, 'ar', 'ar', 'success', 'unknown'),
    ).toBe(false);
  });

  test('normalizeCoverLetterGroundingStatus does not coerce missing to passed', () => {
    expect(normalizeCoverLetterGroundingStatus(undefined)).toBe('missing');
    expect(normalizeCoverLetterGroundingStatus(null)).toBe('missing');
    expect(normalizeCoverLetterGroundingStatus('')).toBe('missing');
    expect(normalizeCoverLetterGroundingStatus('validated')).toBe('passed');
    expect(normalizeCoverLetterGroundingStatus('weird-legacy')).toBe('invalid');
  });
});
