import { describe, expect, test } from 'vitest';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import { activateCoverLetterContentWithClientGrounding } from '../cover-letter-client-grounding';
import { validateCoverLetterGrounding } from '../cover-letter-grounding';
import {
  isCoverLetterContentCurrent,
  isCoverLetterDownloadAllowed,
  normalizeCoverLetterGroundingStatus,
} from '../cover-letter-flow';
import { computeCoverLetterPdfParagraphs } from '../cover-letter-pdf';
import {
  countLeadingDateLinesAfterStrip,
  stripCoverLetterExportHeader,
} from '../cover-letter-header';
import { countFactsByCategory, COVER_LETTER_GROUNDING_BACKEND_REVISION } from '../cover-letter-grounding-diagnostics';
import { stripLeadingDateForDocx } from '../export';

const SPARSE = buildCoverLetterFactSet({
  personalName: 'Alex Carter',
  jobTitle: 'Software Developer',
  companyName: 'Snag',
  experience: [],
  skills: [],
  education: [],
  certifications: [],
  languages: [],
  summary: '',
});

const INVENTED_EN = `Alex Carter
alex@example.com
+1 555 0100

July 13, 2026

Dear Snag Hiring Team,

I am writing to apply for the Software Developer role at Snag. I bring full-stack experience with JavaScript, Python, and cloud infrastructure, delivering scalable applications.

In Agile work environments I have taken project ownership from conception to production and led technical initiatives.

Sincerely,
Alex Carter`;

const INVENTED_HI = `Alex Carter

13 जुलाई 2026

प्रिय Snag टीम,

मेरे पास सॉफ्टवेयर डेवलपर के रूप में कई वर्षों का अनुभव है। मैं जटिल सिस्टम और उच्च-प्रदर्शन अनुप्रयोग बनाता हूँ और टीम का नेतृत्व करता हूँ।

मेरी full-stack, databases, APIs और code review विशेषज्ञता Agile पद्धति में गुणवत्ता और उत्पादकता में सुधार लाती है।

सादर,
Alex Carter`;

const INVENTED_AR = `Alex Carter

١٣ يوليو ٢٠٢٦

إلى فريق Snag،

أتمتع بسجل قوي من الإنجازات التقنية وخبرة واسعة تمتد من التصميم المعماري حتى الإطلاق، بما في ذلك تطوير واجهات برمجة التطبيقات وتقليل أوقات الاستجابة وفق منهجية Agile.

مع خالص التحية،
Alex Carter`;

describe('sparse request facts', () => {
  test('sparse Snag/Software Developer input has zero work and skill facts and no placeholders', () => {
    const counts = countFactsByCategory(SPARSE);
    expect(counts.work_history).toBe(0);
    expect(counts.skill).toBe(0);
    expect(counts.tool).toBe(0);
    expect(counts.programming_language).toBe(0);
    expect(counts.leadership).toBe(0);
    expect(counts.numeric_achievement).toBe(0);
    expect(counts.years_experience).toBe(0);
    expect(SPARSE.isSparse).toBe(true);
    expect(SPARSE.facts.some((f) => /javascript|python|react|sample|placeholder/i.test(f.value))).toBe(false);
    expect(SPARSE.facts.find((f) => f.type === 'target_company')?.value).toBe('Snag');
    expect(SPARSE.facts.find((f) => f.type === 'target_position')?.value).toBe('Software Developer');
  });
});

describe('client-side sparse validation for invented drafts', () => {
  test('catches invented English claims', () => {
    const result = validateCoverLetterGrounding(INVENTED_EN, SPARSE);
    expect(result.valid).toBe(false);
    const kinds = new Set(result.violations.map((v) => v.kind));
    expect(kinds.has('named_skill_or_tool')).toBe(true);
    expect(kinds.has('leadership_claim') || kinds.has('experience_strength_claim')).toBe(true);
  });

  test('catches invented Hindi claims', () => {
    const result = validateCoverLetterGrounding(INVENTED_HI, SPARSE);
    expect(result.valid).toBe(false);
    const kinds = new Set(result.violations.map((v) => v.kind));
    expect(kinds.has('named_skill_or_tool') || kinds.has('experience_strength_claim') || kinds.has('leadership_claim')).toBe(true);
  });

  test('catches invented Arabic claims', () => {
    const result = validateCoverLetterGrounding(INVENTED_AR, SPARSE);
    expect(result.valid).toBe(false);
    const kinds = new Set(result.violations.map((v) => v.kind));
    expect(
      kinds.has('named_skill_or_tool') ||
        kinds.has('experience_strength_claim') ||
        kinds.has('achievement_claim'),
    ).toBe(true);
  });
});

describe('fail-closed client activation', () => {
  test('legacy response without groundingStatus cannot become active server content', () => {
    const activation = activateCoverLetterContentWithClientGrounding({
      serverContent: INVENTED_EN,
      serverGroundingRaw: undefined,
      backendRevision: undefined,
      locale: 'en',
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Snag',
      factSet: SPARSE,
    });
    expect(normalizeCoverLetterGroundingStatus(undefined)).toBe('missing');
    expect(activation.serverGroundingStatus).toBe('missing');
    expect(activation.clientFallbackUsed).toBe(true);
    expect(activation.accepted).toBe(true);
    expect(activation.groundingStatus).toBe('fallback');
    expect(activation.content).not.toMatch(/JavaScript|Python|cloud infrastructure|Agile/i);
    expect(
      isCoverLetterContentCurrent(INVENTED_EN, 'en', 'en', 'success', 'missing'),
    ).toBe(false);
    expect(
      isCoverLetterDownloadAllowed(INVENTED_EN, 'en', 'en', 'success', 'missing'),
    ).toBe(false);
    expect(
      isCoverLetterDownloadAllowed(activation.content, 'en', 'en', 'success', activation.groundingStatus),
    ).toBe(true);
  });

  test('unknown groundingStatus is rejected for server text and triggers fallback', () => {
    const activation = activateCoverLetterContentWithClientGrounding({
      serverContent: INVENTED_HI,
      serverGroundingRaw: 'totally-unknown',
      backendRevision: 'old',
      locale: 'hi',
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Snag',
      factSet: SPARSE,
    });
    expect(activation.serverGroundingStatus).toBe('invalid');
    expect(activation.groundingStatus).toBe('fallback');
    expect(activation.clientFallbackUsed).toBe(true);
    expect(activation.schemaMismatch).toBe(true);
  });

  test('schema-version mismatch is visible in activation', () => {
    const cleanSparse =
      'Dear Snag Hiring Team,\n\nI am applying for the Software Developer role at Snag and am motivated to learn and contribute.\n\nI would welcome an interview.\n\nSincerely,\nAlex Carter';
    const activation = activateCoverLetterContentWithClientGrounding({
      serverContent: cleanSparse,
      serverGroundingRaw: 'passed',
      backendRevision: 'legacy-no-revision',
      locale: 'en',
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Snag',
      factSet: SPARSE,
    });
    expect(activation.schemaMismatch).toBe(true);
    expect(COVER_LETTER_GROUNDING_BACKEND_REVISION).toBe('grounding-v1');
  });
});

describe('one date only in en/hi/ar export prep', () => {
  test('strips name, email, phone, and date header for English', () => {
    const cleaned = stripCoverLetterExportHeader(INVENTED_EN, 'Alex Carter');
    expect(countLeadingDateLinesAfterStrip(INVENTED_EN, 'Alex Carter')).toBe(0);
    expect(cleaned).not.toMatch(/^July 13, 2026/m);
    expect(cleaned).toMatch(/Dear Snag/);
    const paragraphs = computeCoverLetterPdfParagraphs(INVENTED_EN, 'Alex Carter');
    const joined = paragraphs.join('\n');
    expect(joined.match(/2026/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test('strips Hindi localized date line once', () => {
    const header = `Alex Carter\n\n13 जुलाई 2026\n\nप्रिय टीम,\n\nमैं आवेदन कर रहा हूँ।`;
    expect(countLeadingDateLinesAfterStrip(header, 'Alex Carter')).toBe(0);
    const cleaned = stripCoverLetterExportHeader(header, 'Alex Carter');
    expect(cleaned.startsWith('प्रिय')).toBe(true);
    expect(stripLeadingDateForDocx('13 जुलाई 2026\n\nBody')).toBe('Body');
  });

  test('strips Arabic localized date line once', () => {
    const header = `Alex Carter\n\n13 يوليو 2026\n\nالسادة الكرام،\n\nأكتب للتقدم.`;
    expect(countLeadingDateLinesAfterStrip(header, 'Alex Carter')).toBe(0);
    const cleaned = stripCoverLetterExportHeader(header, 'Alex Carter');
    expect(cleaned).toContain('السادة');
    expect(stripLeadingDateForDocx('30 أبريل 2026\n\nBody')).toBe('Body');
  });
});
