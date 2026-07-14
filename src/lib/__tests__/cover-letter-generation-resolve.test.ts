import { describe, expect, test } from 'vitest';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import {
  normalizeCoverLetterGender,
  coverLetterGendersEqual,
} from '../cover-letter-gender';
import {
  contentMatchesRequestedLocale,
  assembleCoverLetterContent,
} from '../cover-letter-generation';
import {
  buildDeterministicSparseCoverLetter,
  validateCoverLetterGrounding,
} from '../cover-letter-grounding';
import {
  resolveCoverLetterGenerationResult,
  getLastCoverLetterGenerationDiagnostics,
} from '../cover-letter-generation-resolve';
import {
  isCoverLetterDownloadAllowed,
  shouldApplyCoverLetterGenerationResult,
  type ActiveCoverLetterRequest,
} from '../cover-letter-flow';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from '../cover-letter-grounding-diagnostics';
import type { Locale } from '../i18n/translations';

const ALL_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

const SPARSE = buildCoverLetterFactSet({
  personalName: 'Alex Carter',
  jobTitle: 'Software Developer',
  companyName: 'Acme',
});

const WITH_FACT = buildCoverLetterFactSet({
  personalName: 'Alex Carter',
  jobTitle: 'Software Developer',
  companyName: 'Acme',
  experience: [{ position: 'Retail Associate', company: 'Shop', description: 'Helped customers' }],
  skills: ['Excel'],
});

describe('gender normalization aliases', () => {
  test('prefer_not_to_say and unspecified normalize identically', () => {
    expect(normalizeCoverLetterGender('prefer_not_to_say')).toBe('unspecified');
    expect(normalizeCoverLetterGender('prefer-not-to-say')).toBe('unspecified');
    expect(normalizeCoverLetterGender('not_specified')).toBe('unspecified');
    expect(normalizeCoverLetterGender('unspecified')).toBe('unspecified');
    expect(normalizeCoverLetterGender('')).toBe('unspecified');
    expect(normalizeCoverLetterGender(null)).toBe('unspecified');
    expect(coverLetterGendersEqual('prefer_not_to_say', 'unspecified')).toBe(true);
  });

  test('active request accepts prefer_not_to_say as unspecified', () => {
    const active: ActiveCoverLetterRequest = {
      requestId: 'r1',
      locale: 'hi',
      gender: normalizeCoverLetterGender('prefer_not_to_say'),
    };
    expect(active.gender).toBe('unspecified');
    expect(shouldApplyCoverLetterGenerationResult(active, 'r1', 'hi', 'prefer_not_to_say')).toBe(true);
    expect(shouldApplyCoverLetterGenerationResult(active, 'r1', 'hi', 'unspecified')).toBe(true);
    expect(shouldApplyCoverLetterGenerationResult(active, 'r1', 'hi', 'male')).toBe(false);
  });

  test('late male cannot overwrite female; late female cannot overwrite unspecified', () => {
    const female: ActiveCoverLetterRequest = { requestId: 'f', locale: 'hi', gender: 'female' };
    const unspecified: ActiveCoverLetterRequest = { requestId: 'u', locale: 'hi', gender: 'unspecified' };
    expect(shouldApplyCoverLetterGenerationResult(female, 'male-late', 'hi', 'male')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(female, 'f', 'hi', 'male')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(unspecified, 'u', 'hi', 'female')).toBe(false);
    expect(shouldApplyCoverLetterGenerationResult(unspecified, 'u', 'hi', 'prefer_not_to_say')).toBe(true);
  });
});

describe('Hindi / Japanese locale validation with Latin names', () => {
  test('short Hindi with Latin name/title passes', () => {
    const text =
      'Alex Carter\n\nAcme की सम्मानित भर्ती टीम को,\n\nSoftware Developer पद के लिए यह आवेदन प्रस्तुत है।\n\nसादर,\nAlex Carter';
    expect(contentMatchesRequestedLocale(text, 'hi')).toBe(true);
  });

  test('short Japanese with Latin name/company/title passes', () => {
    const text =
      'Alex Carter\n\nAcme採用ご担当者様\n\nAcmeのSoftware Developer職に応募いたします。\n\n敬具\nAlex Carter';
    expect(contentMatchesRequestedLocale(text, 'ja')).toBe(true);
  });
});

describe('resolveCoverLetterGenerationResult recovery', () => {
  test('Hindi male/female/unspecified activate from invented server Hindi', () => {
    const invented =
      'मैं Acme में Software Developer पद हेतु आवेदन कर रहा हूँ। मेरे पास व्यापक Java अनुभव है।\n\nसादर,\nAlex Carter';
    for (const gender of ['male', 'female', 'prefer_not_to_say'] as const) {
      const active: ActiveCoverLetterRequest = {
        requestId: 'hi-1',
        locale: 'hi',
        gender: normalizeCoverLetterGender(gender),
      };
      const resolved = resolveCoverLetterGenerationResult({
        active,
        requestId: 'hi-1',
        requestedLocale: 'hi',
        selectedLocale: 'hi',
        selectedGenderRaw: gender,
        requestedGenderNormalized: normalizeCoverLetterGender(gender),
        serverContent: invented,
        serverGroundingRaw: 'passed',
        backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
        candidateName: 'Alex Carter',
        jobTitle: 'Software Developer',
        companyName: 'Acme',
        factSet: SPARSE,
      });
      expect(resolved.outcome === 'success' || resolved.outcome === 'recovered').toBe(true);
      expect(resolved.content.trim().length).toBeGreaterThan(0);
      expect(resolved.toastKind).toBe('none');
      expect(
        isCoverLetterDownloadAllowed(resolved.content, 'hi', 'hi', 'success', resolved.groundingStatus),
      ).toBe(true);
      if (gender === 'prefer_not_to_say') {
        expect(resolved.content).not.toMatch(/चाहता\/चाहती|रहा\/रही/);
        expect(resolved.content).not.toMatch(/चाहता हूँ|चाहती हूँ/);
      }
      if (gender === 'female' && resolved.clientFallbackUsed) {
        expect(resolved.content).toContain('चाहती हूँ');
      }
      if (gender === 'male' && resolved.clientFallbackUsed) {
        expect(resolved.content).toContain('चाहता हूँ');
      }
    }
  });

  test('Japanese English draft recovers via local fallback without AI-unavailable toast', () => {
    const active: ActiveCoverLetterRequest = {
      requestId: 'ja-1',
      locale: 'ja',
      gender: 'unspecified',
    };
    const resolved = resolveCoverLetterGenerationResult({
      active,
      requestId: 'ja-1',
      requestedLocale: 'ja',
      selectedLocale: 'ja',
      selectedGenderRaw: 'prefer_not_to_say',
      requestedGenderNormalized: 'unspecified',
      serverContent:
        'Dear Hiring Team,\n\nI have extensive Java experience leading projects.\n\nSincerely,\nAlex Carter',
      serverGroundingRaw: 'passed',
      backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
      factSet: SPARSE,
    });
    expect(resolved.outcome).toBe('recovered');
    expect(resolved.groundingStatus).toBe('fallback');
    expect(resolved.toastKind).toBe('none');
    expect(resolved.errorCode).toBeNull();
    expect(contentMatchesRequestedLocale(resolved.content, 'ja')).toBe(true);
    expect(
      isCoverLetterDownloadAllowed(resolved.content, 'ja', 'ja', 'success', 'fallback'),
    ).toBe(true);
  });

  test('API failure recovers via fallback without api_unavailable toast', () => {
    const active: ActiveCoverLetterRequest = {
      requestId: 'api-1',
      locale: 'hi',
      gender: 'unspecified',
    };
    const resolved = resolveCoverLetterGenerationResult({
      active,
      requestId: 'api-1',
      requestedLocale: 'hi',
      selectedLocale: 'hi',
      selectedGenderRaw: '',
      requestedGenderNormalized: 'unspecified',
      apiError: { message: 'AI service is temporarily unavailable', status: 500, name: 'Error' },
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
      factSet: SPARSE,
    });
    expect(resolved.outcome).toBe('recovered');
    expect(resolved.toastKind).toBe('none');
    expect(resolved.groundingStatus).toBe('fallback');
    expect(getLastCoverLetterGenerationDiagnostics()?.localFallbackAttempted).toBe(true);
  });

  test('stale response has no AI-unavailable toast', () => {
    const active: ActiveCoverLetterRequest = {
      requestId: 'newer',
      locale: 'hi',
      gender: 'female',
    };
    const resolved = resolveCoverLetterGenerationResult({
      active,
      requestId: 'older',
      requestedLocale: 'hi',
      selectedLocale: 'hi',
      selectedGenderRaw: 'female',
      requestedGenderNormalized: 'female',
      serverContent: 'some content',
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Acme',
      factSet: SPARSE,
    });
    expect(resolved.outcome).toBe('stale');
    expect(resolved.toastKind).toBe('none');
    expect(resolved.errorCode).toBe('stale_response');
  });

  test('all locales sparse: invent/wrong-lang recovery yields trusted content', () => {
    const failures: string[] = [];
    for (const locale of ALL_LOCALES) {
      for (const genderRaw of ['male', 'female', 'prefer_not_to_say', ''] as const) {
        for (const factSet of [SPARSE, WITH_FACT]) {
          const gender = normalizeCoverLetterGender(genderRaw);
          const active: ActiveCoverLetterRequest = {
            requestId: `${locale}-${gender}`,
            locale,
            gender,
          };
          const wrongLang =
            locale === 'en'
              ? 'السلام عليكم هذا نص عربي طويل جدا جدا جدا جدا جدا جدا جدا جدا جدا جدا'
              : 'Dear Hiring Team,\n\nI invented Java, Python, leadership, and Agile expertise.\n\nSincerely,\nAlex Carter';
          const resolved = resolveCoverLetterGenerationResult({
            active,
            requestId: `${locale}-${gender}`,
            requestedLocale: locale,
            selectedLocale: locale,
            selectedGenderRaw: genderRaw,
            requestedGenderNormalized: gender,
            serverContent: wrongLang,
            serverGroundingRaw: 'failed',
            backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
            candidateName: 'Alex Carter',
            jobTitle: 'Software Developer',
            companyName: 'Acme',
            factSet,
          });
          const downloads = isCoverLetterDownloadAllowed(
            resolved.content,
            locale,
            locale,
            'success',
            resolved.groundingStatus,
          );
          if (
            !(resolved.outcome === 'success' || resolved.outcome === 'recovered') ||
            !downloads ||
            resolved.toastKind === 'api_unavailable'
          ) {
            failures.push(
              JSON.stringify({
                locale,
                genderRaw,
                outcome: resolved.outcome,
                toast: resolved.toastKind,
                code: resolved.errorCode,
                status: resolved.groundingStatus,
                downloads,
              }),
            );
          }
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('deterministic fallback remains gender-correct and slash-free for Hindi', () => {
    for (const gender of ['male', 'female', 'unspecified'] as const) {
      const letter = buildDeterministicSparseCoverLetter('hi', {
        candidateName: 'Alex Carter',
        jobTitle: 'Software Developer',
        companyName: 'Acme',
        factSet: SPARSE,
        dateLine: '14 जुलाई 2026',
        gender,
      });
      const text = assembleCoverLetterContent(letter);
      expect(validateCoverLetterGrounding(text, SPARSE).valid).toBe(true);
      expect(text).not.toMatch(/चाहता\/चाहती|रहा\/रही/);
      if (gender === 'female') {
        expect(text).toContain('कर रही हूँ');
        expect(text).toContain('चाहती हूँ');
      }
      if (gender === 'male') {
        expect(text).toContain('कर रहा हूँ');
        expect(text).toContain('चाहता हूँ');
      }
      if (gender === 'unspecified') {
        expect(text).toContain('यह आवेदन प्रस्तुत है');
      }
    }
  });
});
