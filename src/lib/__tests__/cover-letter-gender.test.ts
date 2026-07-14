import { describe, expect, test } from 'vitest';
import {
  getCoverLetterGenderInstruction,
  normalizeCoverLetterGender,
} from '../cover-letter-gender';
import { buildStructuredCoverLetterPrompt } from '../cover-letter-generation';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import {
  assembleCoverLetterContent,
  generateStructuredCoverLetterWithRetries,
} from '../cover-letter-generation';
import { activateCoverLetterContentWithClientGrounding } from '../cover-letter-client-grounding';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from '../cover-letter-grounding-diagnostics';

describe('cover letter grammatical gender', () => {
  test('normalizeCoverLetterGender maps app values and never invents gender', () => {
    expect(normalizeCoverLetterGender('male')).toBe('male');
    expect(normalizeCoverLetterGender('female')).toBe('female');
    expect(normalizeCoverLetterGender('prefer_not_to_say')).toBe('unspecified');
    expect(normalizeCoverLetterGender('')).toBe('unspecified');
    expect(normalizeCoverLetterGender(undefined)).toBe('unspecified');
    expect(normalizeCoverLetterGender('Alex')).toBe('unspecified');
  });

  test('Hindi gender instructions are explicit and forbid slash placeholders', () => {
    const female = getCoverLetterGenderInstruction('hi', 'female');
    expect(female).toMatch(/FEMALE/);
    expect(female).toContain('चाहती हूँ');
    expect(female).toContain('प्रस्तुत कर रही हूँ');
    expect(female).toMatch(/Never use slash|never use slash/i);

    const male = getCoverLetterGenderInstruction('hi', 'male');
    expect(male).toMatch(/MALE/);
    expect(male).toContain('चाहता हूँ');
    expect(male).toContain('प्रस्तुत कर रहा हूँ');

    const neutral = getCoverLetterGenderInstruction('hi', 'prefer_not_to_say');
    expect(neutral).toMatch(/Unspecified|neutral/i);
    expect(neutral).toMatch(/slash/i);

    expect(getCoverLetterGenderInstruction('en', 'female')).toBe('');
    expect(getCoverLetterGenderInstruction('ja', 'male')).toBe('');
  });

  test('structured prompt includes gender note for Hindi female', () => {
    const note = getCoverLetterGenderInstruction('hi', 'female');
    const prompt = buildStructuredCoverLetterPrompt({
      languageName: 'Hindi',
      locale: 'hi',
      displayName: 'Alex Carter',
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
      fallbackRole: 'the role',
      fallbackCompany: 'the company',
      toneDesc: 'formal',
      variantNote: '',
      genderNote: note,
      closing: 'सादर',
      dateLine: '14 जुलाई 2026',
    });
    expect(prompt).toContain('GENDER (MANDATORY)');
    expect(prompt).toContain('FEMALE');
    expect(prompt).toContain('चाहती हूँ');
    expect(prompt).toContain('When GENDER says FEMALE');
  });

  test('repair/fallback path preserves Hindi female after invented content', async () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
    });
    const invented = {
      dateLine: '14 जुलाई 2026',
      greeting: 'Acme की भर्ती टीम को,',
      paragraph1:
        'मैं Acme में Software Developer पद के लिए आवेदन कर रही हूँ। मेरे पास व्यापक अनुभव है और मैं Java तथा Python विशेषज्ञ हूँ।',
      paragraph2: 'मैंने कई परियोजनाओं का नेतृत्व किया है और टीम का मार्गदर्शन किया है।',
      paragraph3:
        'Acme की उत्पाद गुणवत्ता मुझे प्रेरित करती है, और मैं आपकी टीम में योगदान देने के लिए उत्सुक हूँ।',
      closing: 'मैं साक्षात्कार चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
      signOff: 'सादर',
      candidateName: 'Alex Carter',
    };

    const result = await generateStructuredCoverLetterWithRetries({
      locale: 'hi',
      closing: 'सादर',
      candidateName: 'Alex Carter',
      displayName: 'Alex Carter',
      companyName: 'Acme',
      jobTitle: 'Software Developer',
      languageName: 'Hindi',
      toneDesc: 'formal',
      variantNote: '',
      genderNote: getCoverLetterGenderInstruction('hi', 'female'),
      gender: 'female',
      fallbackRole: 'the role',
      fallbackCompany: 'the company',
      factSet: facts,
      generate: async () => JSON.stringify(invented),
    });

    expect(result.fallbackUsed).toBe(true);
    const text = assembleCoverLetterContent(result.letter);
    expect(text).toContain('प्रस्तुत कर रही हूँ');
    expect(text).toContain('चाहती हूँ');
    expect(text).not.toContain('चाहता हूँ');
    expect(text).not.toContain('Java');
  });

  test('repair/fallback path preserves Hindi male after invented content', async () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
    });
    const invented = {
      dateLine: '14 जुलाई 2026',
      greeting: 'Acme की भर्ती टीम को,',
      paragraph1:
        'मैं Acme में Software Developer पद के लिए आवेदन कर रहा हूँ। मेरे पास व्यापक अनुभव है और मैं Java तथा Python विशेषज्ञ हूँ।',
      paragraph2: 'मैंने कई परियोजनाओं का नेतृत्व किया है और टीम का मार्गदर्शन किया है।',
      paragraph3:
        'Acme की उत्पाद गुणवत्ता मुझे प्रेरित करती है, और मैं आपकी टीम में योगदान देने के लिए उत्सुक हूँ।',
      closing: 'मैं साक्षात्कार चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
      signOff: 'सादर',
      candidateName: 'Alex Carter',
    };

    const result = await generateStructuredCoverLetterWithRetries({
      locale: 'hi',
      closing: 'सादर',
      candidateName: 'Alex Carter',
      displayName: 'Alex Carter',
      companyName: 'Acme',
      jobTitle: 'Software Developer',
      languageName: 'Hindi',
      toneDesc: 'formal',
      variantNote: '',
      genderNote: getCoverLetterGenderInstruction('hi', 'male'),
      gender: 'male',
      fallbackRole: 'the role',
      fallbackCompany: 'the company',
      factSet: facts,
      generate: async () => JSON.stringify(invented),
    });

    expect(result.fallbackUsed).toBe(true);
    const text = assembleCoverLetterContent(result.letter);
    expect(text).toContain('प्रस्तुत कर रहा हूँ');
    expect(text).toContain('चाहता हूँ');
    expect(text).not.toContain('चाहती हूँ');
  });

  test('client fallback preserves unspecified Hindi neutrality', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
    });
    const activation = activateCoverLetterContentWithClientGrounding({
      serverContent: 'मैं चाहता हूँ कि टीम मुझे नियुक्त करे और मैं Java विशेषज्ञ हूँ।',
      serverGroundingRaw: 'failed',
      backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
      locale: 'hi',
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
      factSet: facts,
      gender: 'prefer_not_to_say',
    });
    expect(activation.accepted).toBe(true);
    expect(activation.clientFallbackUsed).toBe(true);
    expect(activation.content).toContain('यह आवेदन प्रस्तुत है');
    expect(activation.content).not.toMatch(/चाहता हूँ|चाहती हूँ|कर रहा हूँ|कर रही हूँ/);
    expect(activation.content).not.toMatch(/चाहता\/चाहती/);
  });
});
