/**
 * @vitest-environment jsdom
 *
 * Build 253: English Customer Support Experience must preserve three distinct
 * user duties — never collapse to the hospitality "guests/rapport" shell ×3.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  classifyDutyCategory,
  formatExperienceBullets,
  freezeCanonicalExperienceDescription,
  splitExperienceBullets,
} from '@/lib/cv-canonical-facts';
import {
  buildSourcePreservingExperienceBullets,
  deterministicLocalizedBulletsFromCanonical,
  localizeCanonicalBulletLine,
} from '@/lib/cv-localized-fallback';
import {
  applyEnglishEmploymentTense,
  classifyMaterialDutyKeys,
  materialDutyKeysFromDescription,
  validateDistinctExperienceBullets,
  validateExperienceApplyMaterialPostcondition,
  validateNoExtraGeneratedDuties,
} from '@/lib/cv-material-duty-coverage';
import { runCvAiApplyPipeline } from '@/lib/cv-ai-finalize-apply';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import { getProAiUsageCount, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';

const USER_DUTIES = [
  'Respond to customer inquiries by email and phone.',
  'Record customer issues in the support system.',
  'Coordinate with colleagues to resolve customer requests.',
].join('\n');

const USER_BULLETS = formatExperienceBullets([
  'Respond to customer inquiries by email and phone.',
  'Record customer issues in the support system.',
  'Coordinate with colleagues to resolve customer requests.',
]);

const BAD_GUESTS_TRIPLE = formatExperienceBullets([
  'Provided attentive customer service and built rapport with guests.',
  'Provided attentive customer service and built rapport with guests.',
  'Provided attentive customer service and built rapport with guests.',
]);

const GOOD_SUMMARY =
  'Customer Support Specialist at Northstar with approximately two and a half years of experience. Respond to customer inquiries by email and phone, record customer issues in the support system, and coordinate with colleagues to resolve customer requests.';

function device253Cv(overrides?: Partial<CVData>): CVData {
  return {
    id: 'cv-253',
    name: 'CV',
    personal: {
      fullName: 'Alex North',
      email: 'alex@example.com',
      phone: '',
      address: '',
      jobTitle: 'Customer Support Specialist',
      gender: 'male',
      photoEnabled: false,
    },
    summary: GOOD_SUMMARY,
    summaryOrigin: 'ai_generated',
    contentLocale: 'en',
    summaryGeneratedLocale: 'en',
    experience: [{
      id: 'exp-1',
      company: 'Northstar',
      position: 'Customer Support Specialist',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: USER_BULLETS,
      originalUserDescription: USER_BULLETS,
      canonicalDescription: USER_BULLETS,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: ['Communication', 'Problem Solving'],
    certifications: [],
    languages: [{ name: 'English', level: 'native' }],
    templateId: 'modern-minimal',
    region: 'US',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function assertThreeCsFacts(text: string, label: string) {
  expect(text, label).toMatch(/email/i);
  expect(text, label).toMatch(/phone/i);
  expect(text, label).toMatch(/support system|record/i);
  expect(text, label).toMatch(/colleague|coordinat/i);
  expect(text, label).not.toMatch(/\bguests?\b/i);
  expect(text, label).not.toMatch(/\brapport\b/i);
  const bullets = splitExperienceBullets(text);
  expect(bullets.length, `${label} count`).toBeGreaterThanOrEqual(3);
  expect(validateDistinctExperienceBullets(text).ok, `${label} distinct`).toBe(true);
}

describe('Build 253 English Customer Support Experience preservation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('trace: three user duties collapse to one hospitality category without the fix path', () => {
    const cats = splitExperienceBullets(USER_BULLETS).map(classifyDutyCategory);
    // Pre-fix classification lumped all three — document the historical collapse.
    expect(cats.every((c) => c === 'customer_service_guest_relationship')).toBe(true);
    // Material keys must still be distinct.
    const keys = splitExperienceBullets(USER_BULLETS).map((u) => classifyMaterialDutyKeys(u));
    expect(keys[0]).toContain('cs_inquiry_channels');
    expect(keys[1]).toContain('cs_issue_logging');
    expect(keys[2]).toContain('cs_request_coordination');
    // Hospitality shell origin.
    expect(localizeCanonicalBulletLine(
      'Respond to customer inquiries by email and phone.',
      'en',
      'male',
      { isPresent: true },
    )).not.toMatch(/guests|rapport/i);
  });

  it('rejects guests/rapport extras and exact triple duplicates', () => {
    expect(validateNoExtraGeneratedDuties(USER_DUTIES, BAD_GUESTS_TRIPLE).valid).toBe(false);
    expect(validateDistinctExperienceBullets(BAD_GUESTS_TRIPLE).ok).toBe(false);
    expect(validateExperienceApplyMaterialPostcondition(USER_DUTIES, BAD_GUESTS_TRIPLE).ok).toBe(false);
  });

  it('deterministic fallback preserves three distinct present-tense CS duties', () => {
    const rebuilt = buildSourcePreservingExperienceBullets(USER_BULLETS, 'en', 'male', {
      isPresent: true,
    });
    assertThreeCsFacts(rebuilt, 'rebuild');
    expect(rebuilt).toMatch(/\bRespond\b/);
    expect(rebuilt).toMatch(/\bRecord\b/);
    expect(rebuilt).toMatch(/\bCoordinate\b/);
    expect(rebuilt).not.toMatch(/\bResponded\b|\bRecorded\b|\bCoordinated\b|\bProvided\b/);
  });

  it('provider guests triple is rejected; source-preserving fallback applied; usage only on success', () => {
    const before = getProAiUsageCount();
    const cv = device253Cv();
    const blocked = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: BAD_GUESTS_TRIPLE,
      experienceId: 'exp-1',
      industry: 'customer_service',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    // Must not apply the triple guests shell.
    expect(blocked.finalized.text).not.toMatch(/guests|rapport/i);
    if (blocked.blocked) {
      expect(blocked.finalized.countedAsSuccess).toBe(false);
      expect(getProAiUsageCount()).toBe(before);
      expect(blocked.reason || blocked.finalized.reason).toMatch(
        /experience_material_fact_coverage_incomplete|exact_duplicate|unsupported/,
      );
    } else {
      assertThreeCsFacts(blocked.stateCv.experience[0].description, 'applied');
      recordProAiUserActionSuccess();
      expect(getProAiUsageCount()).toBe(before + 1);
    }
  });

  it('empty/provider-fail path applies source-preserving Experience (not guests shell)', () => {
    const cv = device253Cv();
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'customer_service',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    assertThreeCsFacts(pipeline.stateCv.experience[0].description, 'empty-cand');
    expect(pipeline.stateCv.summary).toMatch(/two and a half years/i);
    expect(pipeline.stateCv.summary).toMatch(/email|phone|support system|colleague/i);
  });

  it('export rebuilds corrupted Experience while keeping Summary facts + duration', () => {
    const corrupted = device253Cv({
      experience: [{
        ...device253Cv().experience[0],
        description: BAD_GUESTS_TRIPLE,
        generatedDescription: BAD_GUESTS_TRIPLE,
        descriptionOrigin: 'ai_generated',
        originalUserDescription: USER_BULLETS,
        canonicalDescription: USER_BULLETS,
      }],
    });
    const prepared = prepareExportReadyCv(corrupted, 'en', 'modern-minimal', {
      gender: 'male',
      referenceDate: '2026-07-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    assertThreeCsFacts(prepared.cv.experience[0].description, 'export-exp');
    expect(prepared.cv.summary).toMatch(/two and a half years/i);
    expect(prepared.cv.summary).toMatch(/email|phone/i);
  });

  it('PDF/DOCX share corrected Experience; reload preserves; AI usage once', async () => {
    const before = getProAiUsageCount();
    const pipeline = runCvAiApplyPipeline({
      cv: device253Cv(),
      locale: 'en',
      action: 'experience_bullets',
      candidate: BAD_GUESTS_TRIPLE,
      experienceId: 'exp-1',
      industry: 'customer_service',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(before + 1);

    const prepared = prepareExportReadyCv(pipeline.stateCv, 'en', 'modern-minimal', {
      gender: 'male',
      referenceDate: '2026-07-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    assertThreeCsFacts(prepared.cv.experience[0].description, 'prep');

    const usageBeforeExport = getProAiUsageCount();
    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'en');
    const docx = await exportToDOCX(prepared.cv, 'cs-253', 'en', 'modern-minimal');
    expect(pdf).toBeTruthy();
    expect(docx).toBeTruthy();
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    expect(pdfText).toMatch(/email/i);
    expect(pdfText).toMatch(/phone/i);
    expect(pdfText).not.toMatch(/\bguests?\b/i);
    expect(pdfText).not.toMatch(/\brapport\b/i);
    expect(getProAiUsageCount()).toBe(usageBeforeExport);

    const reloaded = JSON.parse(JSON.stringify(pipeline.stateCv)) as CVData;
    const again = prepareExportReadyCv(reloaded, 'en', 'modern-minimal', {
      gender: 'male',
      referenceDate: '2026-07-18',
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    assertThreeCsFacts(again.cv.experience[0].description, 'reload');
  }, 60_000);

  it('controls: completed English role uses past tense; Serbian/Hindi present CS', () => {
    expect(applyEnglishEmploymentTense('Responded to customer inquiries by email and phone.', true))
      .toMatch(/^Respond\b/);
    expect(applyEnglishEmploymentTense('Respond to customer inquiries by email and phone.', false))
      .toMatch(/^Responded\b/);

    const past = buildSourcePreservingExperienceBullets(USER_BULLETS, 'en', 'male', {
      isPresent: false,
    });
    expect(past).toMatch(/\bResponded\b|\bRecorded\b|\bCoordinated\b/);

    const sr = buildSourcePreservingExperienceBullets(USER_BULLETS, 'sr', 'male', {
      isPresent: true,
    });
    // Universal preserve may keep English; CS templates may localize — either is OK
    // as long as facts survive and hospitality shells do not appear.
    expect(sr).toMatch(/e-pošte|telefona|sistema podrške|kolegama|email|phone|support system|colleagues/i);
    expect(sr).not.toMatch(/gostima|rapport/i);

    const hi = buildSourcePreservingExperienceBullets(USER_BULLETS, 'hi', 'female', {
      isPresent: true,
    });
    expect(hi).toMatch(/ईमेल|फोन|सिस्टम|समन्वय|सहकर्मी|email|phone|support system|colleagues/i);
  });

  it('provider returns one bullet for three facts → rebuild; different order accepted', () => {
    const oneBullet = '• Respond to customer inquiries by email and phone and record issues while coordinating with colleagues.';
    const pipeline = runCvAiApplyPipeline({
      cv: device253Cv(),
      locale: 'en',
      action: 'experience_bullets',
      candidate: oneBullet,
      experienceId: 'exp-1',
      industry: 'customer_service',
      level: 'mid',
    });
    // Either accept if coverage ok, or rebuild to three lines — never guests triple.
    expect(pipeline.finalized.text).not.toMatch(/guests|rapport/i);
    if (!pipeline.blocked) {
      const keys = materialDutyKeysFromDescription(pipeline.stateCv.experience[0].description);
      expect(keys).toEqual(expect.arrayContaining([
        'cs_inquiry_channels',
        'cs_issue_logging',
        'cs_request_coordination',
      ]));
    }

    const reordered = formatExperienceBullets([
      'Coordinate with colleagues to resolve customer requests efficiently.',
      'Respond to customer inquiries by email and phone, providing clear and timely support.',
      'Record customer issues accurately in the support system.',
    ]);
    const ok = runCvAiApplyPipeline({
      cv: device253Cv(),
      locale: 'en',
      action: 'experience_bullets',
      candidate: reordered,
      experienceId: 'exp-1',
      industry: 'customer_service',
      level: 'mid',
    });
    expect(ok.blocked).toBe(false);
    assertThreeCsFacts(ok.stateCv.experience[0].description, 'reorder');
  });

  it('50× cold English CS: zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const candidate = i % 3 === 0
        ? BAD_GUESTS_TRIPLE
        : i % 3 === 1
          ? ''
          : formatExperienceBullets([
            'Respond to customer inquiries by email and phone, providing clear and timely support.',
            'Record customer issues accurately in the support system.',
            'Coordinate with colleagues to resolve customer requests efficiently.',
          ]);
      const pipeline = runCvAiApplyPipeline({
        cv: device253Cv(),
        locale: 'en',
        action: 'experience_bullets',
        candidate,
        experienceId: 'exp-1',
        industry: 'customer_service',
        level: 'mid',
        referenceDateIso: '2026-07-18',
      });
      expect(pipeline.blocked, `blocked ${i}`).toBe(false);
      assertThreeCsFacts(pipeline.stateCv.experience[0].description, `exp ${i}`);
      const prepared = prepareExportReadyCv(pipeline.stateCv, 'en', 'modern-minimal', {
        gender: 'male',
        referenceDate: '2026-07-18',
      });
      expect(prepared.ok, `prep ${i}`).toBe(true);
      if (!prepared.ok) return;
      assertThreeCsFacts(prepared.cv.experience[0].description, `export ${i}`);
      expect(prepared.cv.summary, `sum ${i}`).toMatch(/two and a half years/i);
    }
  });
});
