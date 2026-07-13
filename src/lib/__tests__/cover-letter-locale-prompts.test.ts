import { describe, expect, test } from 'vitest';
import {
  buildStructuredCoverLetterPrompt,
  contentMatchesRequestedLocale,
  validateStructuredCoverLetter,
} from '../cover-letter-generation';

const PROMPT_BASE = {
  languageName: 'Hindi',
  displayName: 'Alex Carter',
  candidateName: 'Alex Carter',
  companyName: 'Acme Corp',
  fallbackRole: 'the role',
  fallbackCompany: 'the company',
  toneDesc: 'formal',
  variantNote: '',
  genderNote: '',
  closing: 'सादर',
  dateLine: '12 जुलाई 2026',
};

describe('Hindi and Arabic cover letter prompt grounding', () => {
  test('Hindi prompt forbids fabricated claims and limits company praise', () => {
    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      locale: 'hi',
      jobTitle: 'Salesman',
    });
    expect(prompt).toContain('HINDI QUALITY RULES');
    expect(prompt).toContain('natural, professional Hindi');
    expect(prompt).toContain('not a literal English translation');
    expect(prompt).toContain('Do NOT invent revenue increases');
    expect(prompt).toContain('exceeded targets');
    expect(prompt).toContain('Keep company praise brief');
    expect(prompt).toContain('Salesman');
    expect(prompt).toContain('do NOT upgrade, broaden, or replace');
    expect(prompt).toContain('Sales Executive');
    expect(prompt).toContain('Sales Representative');
    expect(prompt).toContain('Sales Manager');
    expect(prompt).toContain('Use ONLY facts from the candidate CV');
  });

  test('Hindi prompt preserves Salesman seniority without role substitution', () => {
    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      locale: 'hi',
      jobTitle: 'Salesman',
    });
    expect(prompt).toMatch(/job title "Salesman"/);
    expect(prompt).toContain('preserve its meaning and seniority');
  });

  test('Arabic prompt requires MSA and forbids invented achievements', () => {
    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      languageName: 'Arabic',
      locale: 'ar',
      jobTitle: 'Salesman',
      closing: 'مع خالص التحية',
    });
    expect(prompt).toContain('ARABIC QUALITY RULES');
    expect(prompt).toContain('Modern Standard Arabic');
    expect(prompt).toContain('not word-for-word English translation');
    expect(prompt).toContain('Do NOT claim Java, Python, C++');
    expect(prompt).toContain('أتطلع إلى فرصة لمناقشة كيف يمكنني إضافة قيمة حقيقية لفريقكم');
    expect(prompt).toContain('أودّ أن أتاح لي الفرصة');
    expect(prompt).toContain('Arabic comma');
    expect(prompt).toContain('Write entirely in Arabic');
    expect(prompt).toContain('Salesman');
    expect(prompt).toContain('Google');
  });

  test('Hindi prompt forbids unsupported experience and skill claims', () => {
    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      locale: 'hi',
      jobTitle: 'Software Developer',
    });
    expect(prompt).toContain('सॉफ़्टवेयर डेवलपर (Software Developer)');
    expect(prompt).toContain('several years of experience');
    expect(prompt).toContain('complex algorithms');
    expect(prompt).toContain('Python/Java/cloud');
    expect(prompt).toContain('Do NOT claim Java, Python, C++');
  });

  test('English prompt does not inject Hindi or Arabic grounding blocks', () => {
    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      languageName: 'English',
      locale: 'en',
      jobTitle: 'Software Engineer',
      closing: 'Sincerely',
      dateLine: 'July 12, 2026',
    });
    expect(prompt).not.toContain('HINDI QUALITY RULES');
    expect(prompt).not.toContain('ARABIC QUALITY RULES');
    expect(prompt).toContain('Write every field entirely in English');
  });

  test('German prompt remains unchanged without hi/ar locale blocks', () => {
    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      languageName: 'German',
      locale: 'de',
      jobTitle: 'Ingenieur',
      closing: 'Mit freundlichen Grüßen',
      dateLine: '12. Juli 2026',
    });
    expect(prompt).not.toContain('HINDI QUALITY RULES');
    expect(prompt).not.toContain('ARABIC QUALITY RULES');
    expect(prompt).toContain('German');
  });

  test('contentMatchesRequestedLocale rejects Devanagari when Arabic requested', () => {
    const hindi = 'मैं सेल्समैन पद के लिए आवेदन कर रहा हूँ। मेरे पास ग्राहक सेवा का व्यावहारिक अनुभव है और मैं टीम में योगदान देना चाहता हूँ।';
    expect(contentMatchesRequestedLocale(hindi, 'ar')).toBe(false);
  });

  test('validateStructuredCoverLetter rejects Arabic output with Devanagari leakage', () => {
    const validArabic = {
      dateLine: '12 يوليو 2026',
      greeting: 'السادة الكرام في Acme،',
      paragraph1: 'أكتب للتقدم لوظيفة بائع في شركتكم ولدي خبرة عملية في خدمة العملاء داخل المتجر.',
      paragraph2: 'ساعدت العملاء في اختيار المنتجات وتقديم المعلومات اللازمة بشكل واضح ومهني.',
      paragraph3: 'أقدر التزام Acme بالجودة وخدمة العملاء وأتطلع للمساهمة مع الفريق بشكل فعال.',
      closing: 'أتطلع لمناقشة ملاءمتي في مقابلة وشكرًا جزيلًا على وقتكم واهتمامكم.',
      signOff: 'مع خالص التحية',
      candidateName: 'Alex Carter',
    };
    const result = validateStructuredCoverLetter(
      validArabic,
      'ar',
      'Alex Carter',
      'Acme',
      'مع خالص التحية',
    );
    expect(result.valid).toBe(true);

    const leaked = validateStructuredCoverLetter(
      {
        ...validArabic,
        greeting: 'मैं आवेदन करता हूँ',
      },
      'ar',
      'Alex Carter',
      'Acme',
      'مع خالص التحية',
    );
    expect(leaked.valid).toBe(false);
    expect(leaked.errors.some((e) => e.includes('Devanagari'))).toBe(true);
  });
});
