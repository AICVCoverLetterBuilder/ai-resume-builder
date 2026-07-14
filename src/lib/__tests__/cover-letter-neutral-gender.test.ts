import { describe, expect, test } from 'vitest';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import {
  buildDeterministicSparseCoverLetter,
  validateCoverLetterGrounding,
} from '../cover-letter-grounding';
import {
  findGenderFormMismatches,
  findSelfCorrectionLeaks,
} from '../cover-letter-gender-validation';
import {
  assembleCoverLetterContent,
  generateStructuredCoverLetterWithRetries,
} from '../cover-letter-generation';
import { getCoverLetterGenderInstruction } from '../cover-letter-gender';
import {
  computeCoverLetterPdfParagraphs,
  computeJapaneseCoverLetterPdfLines,
} from '../cover-letter-pdf';
import { wrapJapanesePdfParagraphLines } from '../cover-letter-japanese-pdf-wrap';
import { activateCoverLetterContentWithClientGrounding } from '../cover-letter-client-grounding';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from '../cover-letter-grounding-diagnostics';
import { isActiveCoverLetterResultEligible, createCoverLetterActiveResult } from '../cover-letter-active-result';

const SPARSE = buildCoverLetterFactSet({
  personalName: 'Many Loom',
  jobTitle: 'Teacher',
  companyName: 'Dioda',
});

describe('unspecified gender + self-correction + Japanese PDF', () => {
  test('Hindi unspecified fallback is impersonal without gendered or third-person forms', () => {
    const letter = buildDeterministicSparseCoverLetter('hi', {
      candidateName: 'Many Loom',
      jobTitle: 'Teacher',
      companyName: 'Dioda',
      factSet: SPARSE,
      dateLine: '14 जुलाई 2026',
      gender: 'prefer_not_to_say',
    });
    const text = assembleCoverLetterContent(letter, 'hi');
    expect(text).toContain('यह आवेदन प्रस्तुत है');
    expect(text).not.toMatch(/चाहता हूँ|चाहती हूँ|कर रहा हूँ|कर रही हूँ/);
    expect(text).not.toMatch(/चाहता\/चाहती|रहा\/रही/);
    expect(text).not.toMatch(/आवेदन कर रहे हैं|आवेदन कर रही हैं/);
    expect(text).not.toMatch(/—\s*नहीं|क्षमा करें/);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'hi', gender: 'unspecified' }).valid).toBe(true);
    const active = createCoverLetterActiveResult({
      content: text,
      locale: 'hi',
      gender: 'unspecified',
      groundingStatus: 'fallback',
      requestId: 'hi-u',
      source: 'fallback',
    });
    expect(isActiveCoverLetterResultEligible(active, 'hi', 'unspecified', 'success')).toBe(true);
  });

  test('Hindi self-correction draft is rejected and recovers via neutral fallback', async () => {
    const leak =
      'मैं अपनी अभिरुचि व्यक्त करना चाहता हूँ — नहीं, मैं इस पद हेतु अपना आवेदन प्रस्तुत कर रहा हूँ — क्षमा करें। Many Loom आवेदन कर रहे हैं।';
    expect(findSelfCorrectionLeaks(leak).length).toBeGreaterThan(0);
    expect(
      validateCoverLetterGrounding(leak, SPARSE, { locale: 'hi', gender: 'unspecified' }).violations.some(
        (v) => v.kind === 'self_correction_leak' || v.kind === 'gender_form_mismatch',
      ),
    ).toBe(true);

    const invented = {
      dateLine: '14 जुलाई 2026',
      greeting: 'Dioda की भर्ती टीम को,',
      paragraph1:
        'मैं Dioda में Teacher पद के लिए अपनी अभिरुचि व्यक्त करना चाहता हूँ — नहीं, मैं इस पद हेतु अपना आवेदन प्रस्तुत कर रहा हूँ — क्षमा करें।',
      paragraph2: 'Many Loom आवेदन कर रहे हैं और साक्षात्कार चाहते हैं।',
      paragraph3: 'Dioda की टीम से जुड़ने में रुचि है और योगदान देने के लिए उत्सुक हूँ।',
      closing: 'साक्षात्कार का अवसर मिले तो धन्यवाद।',
      signOff: 'सादर',
      candidateName: 'Many Loom',
    };

    const result = await generateStructuredCoverLetterWithRetries({
      locale: 'hi',
      closing: 'सादर',
      candidateName: 'Many Loom',
      displayName: 'Many Loom',
      companyName: 'Dioda',
      jobTitle: 'Teacher',
      languageName: 'Hindi',
      toneDesc: 'formal',
      variantNote: '',
      genderNote: getCoverLetterGenderInstruction('hi', 'prefer_not_to_say'),
      gender: 'prefer_not_to_say',
      fallbackRole: 'the role',
      fallbackCompany: 'the company',
      factSet: SPARSE,
      generate: async () => JSON.stringify(invented),
    });

    expect(result.fallbackUsed).toBe(true);
    const text = assembleCoverLetterContent(result.letter, 'hi');
    expect(text).not.toMatch(/—\s*नहीं|क्षमा करें|चाहता हूँ|कर रहा हूँ|आवेदन कर रहे हैं/);
    expect(text).toContain('यह आवेदन प्रस्तुत है');
  });

  test('Arabic unspecified rejects حريص/متاح and feminine counterparts', () => {
    const bad =
      'أتقدم بطلب لشغل وظيفة Teacher. أنا حريص ومتاح للمقابلة ومتحمسة أيضا.';
    const mismatches = findGenderFormMismatches(bad, 'ar', 'unspecified');
    expect(mismatches.some((m) => /حريص|متاح|متحمسة/.test(m))).toBe(true);

    const letter = buildDeterministicSparseCoverLetter('ar', {
      candidateName: 'Many Loom',
      jobTitle: 'Teacher',
      companyName: 'Dioda',
      factSet: SPARSE,
      dateLine: '14 يوليو 2026',
      gender: 'unspecified',
    });
    const text = assembleCoverLetterContent(letter, 'ar');
    expect(text).toContain('أتقدم بطلب');
    expect(text).toContain('تهمّني هذه الفرصة');
    expect(text).toContain('يسعدني حضور مقابلة');
    expect(text).not.toMatch(/حريص|متاح|مستعد|مهتم|متحمس(?!ة)|سعيد(?!ة)/);
    expect(text).not.toMatch(/حريصة|متاحة|مستعدة|مهتمة|متحمسة|سعيدة/);
    expect(text).toContain('مع خالص التحية،');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'ar', gender: 'unspecified' }).valid).toBe(true);
  });

  test('Serbian unspecified keeps Bila bi mi čast style neutrals', () => {
    const text =
      'Poštovani tim,\n\novim putem se prijavljujem. Bila bi mi čast razgovarati o prijavi.\n\nSrdačno,\nAlex';
    expect(findGenderFormMismatches(text, 'sr', 'unspecified')).toEqual([]);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'sr', gender: 'unspecified' }).valid).toBe(true);
  });

  test('Hindi male/female still allow matching forms and reject opposite', () => {
    expect(findGenderFormMismatches('मैं चाहता हूँ और कर रहा हूँ।', 'hi', 'male')).toEqual([]);
    expect(findGenderFormMismatches('मैं चाहती हूँ और कर रही हूँ।', 'hi', 'female')).toEqual([]);
    expect(findGenderFormMismatches('मैं चाहती हूँ।', 'hi', 'male').length).toBeGreaterThan(0);
    expect(findGenderFormMismatches('मैं चाहता हूँ।', 'hi', 'female').length).toBeGreaterThan(0);
  });

  test('Japanese assemble omits comma after 敬具; PDF lines use no ZWSP strategy', () => {
    const letter = buildDeterministicSparseCoverLetter('ja', {
      candidateName: 'Many Loom',
      jobTitle: 'Teacher',
      companyName: 'Dioda',
      factSet: SPARSE,
      dateLine: '2026年7月14日',
      gender: 'unspecified',
    });
    const text = assembleCoverLetterContent(letter, 'ja');
    expect(text).toContain('敬具');
    expect(text).not.toContain('敬具,');
    expect(text).toContain('Dioda');
    expect(text).toContain('Teacher');

    const paragraphs = computeCoverLetterPdfParagraphs(text, 'Many Loom', 'ja');
    expect(paragraphs.join('\n')).not.toContain('\u200B');
    expect(paragraphs.join('\n')).not.toContain('\u00AD');
    expect(paragraphs.join('\n')).toContain('敬具');
    expect(paragraphs.join('\n')).not.toContain('敬具,');

    const lines = computeJapaneseCoverLetterPdfLines(text, 'Many Loom').flat();
    expect(lines.join('')).toContain('敬具');
    expect(lines.some((l) => l.includes('敬具,'))).toBe(false);
    expect(wrapJapanesePdfParagraphLines('ご連絡申し上げます。志望状をお送りします。').join('')).toBe(
      'ご連絡申し上げます。志望状をお送りします。',
    );
  });

  test('client activation rejects Hindi self-correction and uses neutral fallback', () => {
    const leak = `Many Loom

14 जुलाई 2026

Dioda टीम को,

मैं आवेदन प्रस्तुत करना चाहता हूँ — नहीं, क्षमा करें, मैंकर रहा हूँ।

सादर,
Many Loom`;
    const activation = activateCoverLetterContentWithClientGrounding({
      serverContent: leak,
      serverGroundingRaw: 'passed',
      backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
      locale: 'hi',
      candidateName: 'Many Loom',
      jobTitle: 'Teacher',
      companyName: 'Dioda',
      factSet: SPARSE,
      gender: 'prefer_not_to_say',
    });
    expect(activation.accepted).toBe(true);
    expect(activation.clientFallbackUsed).toBe(true);
    expect(activation.content).not.toMatch(/—\s*नहीं|क्षमा करें|चाहता हूँ/);
    expect(activation.content).toContain('यह आवेदन प्रस्तुत है');
  });
});
