/**
 * @vitest-environment jsdom
 *
 * Build 252: After Baker→Pharmacist Experience AI, export must not keep cooking
 * Summary facts, invent regulated pharmacist duties, or duplicate Serbian `godine`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  buildExperienceJobContext,
  buildOccupationAwareExperienceFallback,
  buildOccupationAwareSummaryFallback,
  hasUnsupportedRegulatedPharmacyClaims,
  isSummaryStaleForJobContext,
  scrubOrphanDurationFragments,
  textLooksLikeCookingDuties,
} from '@/lib/cv-experience-job-context';
import { freezeCanonicalExperienceDescription } from '@/lib/cv-canonical-facts';
import { resolveExperienceAiGrounding } from '@/lib/cv-experience-job-context';
import { runCvAiApplyPipeline } from '@/lib/cv-ai-finalize-apply';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { LEGACY_RECOVERED_DISPLAY_DUTIES } from '@/lib/cv-legacy-grounding-recovery';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import { getProAiUsageCount, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';
import {
  formatApproximateDurationPhrase,
  buildExperienceDurationSnapshot,
} from '@/lib/cv-experience-duration';
import { injectDurationPhrase } from '@/lib/cv-content-quality';

const EN_COOKING = [
  '• Prepare dishes according to restaurant standards.',
  '• Maintain workplace hygiene.',
  '• Collaborate with the kitchen team.',
].join('\n');

const HI_COOKING = [
  '• मैं रेस्तरां मानकों के अनुसार व्यंजन तैयार करती हूँ।',
  '• मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ।',
  '• मैं रसोई टीम के साथ सहयोग करती हूँ।',
].join('\n');

const SR_COOKING_SUMMARY =
  'Zaposlena kao apotekar u kompaniji Ztrew od februara 2024. godine, gde priprema jela prema standardima restorana i održava higijenu radnog prostora u saradnji sa kuhinjskim timom.';

const SR_REGULATED_PHARMACY = [
  '• Izdaje lekove na recept i bez recepta.',
  '• Proverava dozu i interakcije lekova.',
  '• Savetuje pacijente o terapiji i neželjenim dejstvima.',
  '• Upravlja zalihama lekova i nabavkom.',
  '• Sarađuje sa lekarima i obezbeđuje farmakoterapiju.',
].join('\n');

const SEMANTIC_COOKING = [
  {
    key: 'food_preparation_restaurant_standards',
    confidence: 'narrow_supported' as const,
    sourceClauseIndex: 0,
  },
  {
    key: 'workplace_hygiene',
    confidence: 'narrow_supported' as const,
    sourceClauseIndex: 1,
  },
  {
    key: 'kitchen_team_collaboration',
    confidence: 'narrow_supported' as const,
    sourceClauseIndex: 2,
  },
];

const COOKING_BAN = /jela|restoran|kuhinj|food preparation|restaurant standards|kitchen/i;
const REGULATED_BAN =
  /recept|prescription|dozir|dosage|interakcij|pacijen|terapij|zalih|nabavk|lekar|farmakoterap|dispens|adverse/i;

function bakerKey() {
  return buildExperienceJobContext({
    position: 'Baker',
    industry: 'hospitality',
    locale: 'hi',
    level: 'mid',
  }).key;
}

function pharmacistCtx() {
  return buildExperienceJobContext({
    position: 'Apotekar',
    industry: 'pharmacy',
    locale: 'sr',
    level: 'mid',
  });
}

function device252Cv(): CVData {
  const baker = bakerKey();
  return {
    id: 'cv-252',
    name: 'CV',
    personal: {
      fullName: 'Ivan Grozni',
      email: 'ivan@example.com',
      phone: '',
      address: '',
      jobTitle: 'Apotekar',
      gender: 'female',
      photoEnabled: false,
    },
    summary: SR_COOKING_SUMMARY,
    summaryOrigin: 'ai_generated',
    contentLocale: 'sr',
    summaryGeneratedLocale: 'sr',
    summaryGenerationContextKey: baker,
    canonicalSummary: SR_COOKING_SUMMARY,
    experience: [{
      id: 'exp-1',
      company: 'Ztrew',
      position: 'Apotekar',
      startDate: '2024-02',
      endDate: '',
      isPresent: true,
      description: HI_COOKING,
      generatedDescription: HI_COOKING,
      generatedLocale: 'hi',
      descriptionOrigin: 'ai_generated',
      originalUserDescription: EN_COOKING,
      canonicalDescription: EN_COOKING,
      groundingRecoverySource: LEGACY_RECOVERED_DISPLAY_DUTIES,
      recoveredSemanticDuties: SEMANTIC_COOKING,
      generationJobContextKey: baker,
      groundingJobContextKey: baker,
    }],
    education: [],
    skills: ['Communication'],
    certifications: [],
    languages: [{ name: 'English', level: 'intermediate' }],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
}

function assertNoCooking(text: string, label: string) {
  expect(textLooksLikeCookingDuties(text), label).toBe(false);
  expect(text, label).not.toMatch(COOKING_BAN);
}

function assertNoRegulated(text: string, label: string) {
  expect(hasUnsupportedRegulatedPharmacyClaims(text), label).toBe(false);
  expect(text, label).not.toMatch(REGULATED_BAN);
}

describe('Build 252 Baker→Pharmacist Summary + export', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks Serbian cooking Summary stale under Apotekar context', () => {
    const ctx = pharmacistCtx();
    expect(isSummaryStaleForJobContext(SR_COOKING_SUMMARY, ctx, {
      summaryOrigin: 'ai_generated',
      summaryGenerationContextKey: bakerKey(),
    })).toBe(true);
  });

  it('rejects regulated pharmacist invention without user facts', () => {
    const cv = device252Cv();
    const ctx = pharmacistCtx();
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'experience_bullets',
      candidate: SR_REGULATED_PHARMACY,
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
      jobContext: ctx,
    });
    expect(pipeline.blocked).toBe(false);
    assertNoRegulated(pipeline.stateCv.experience[0].description, 'exp');
    assertNoCooking(pipeline.stateCv.experience[0].description, 'exp-cook');
    assertNoCooking(pipeline.stateCv.summary, 'sum');
  });

  it('Experience AI then export PDF/DOCX without Summary generate', async () => {
    const ctx = pharmacistCtx();
    const cv = device252Cv();
    const grounding = resolveExperienceAiGrounding(
      cv.experience[0],
      ctx,
      freezeCanonicalExperienceDescription,
    );
    expect(grounding.staleGeneratedContentExcluded).toBe(true);
    expect(grounding.semanticDutyKeysUsed).toEqual([]);

    const beforeUsage = getProAiUsageCount();
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
      jobContext: ctx,
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(beforeUsage + 1);

    const applied = pipeline.stateCv;
    assertNoCooking(applied.experience[0].description, 'applied-exp');
    assertNoRegulated(applied.experience[0].description, 'applied-reg');
    assertNoCooking(applied.summary, 'applied-sum');
    expect(applied.summary).not.toMatch(/\. godine,/i);
    expect(applied.summaryGenerationContextKey).toBe(ctx.key);

    const usageBeforeExport = getProAiUsageCount();
    const prepared = prepareExportReadyCv(applied, 'sr', 'modern-minimal', {
      gender: 'female',
      referenceDate: '2026-07-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const summary = prepared.cv.summary;
    const experience = prepared.cv.experience[0].description;
    assertNoCooking(summary, 'export-sum');
    assertNoCooking(experience, 'export-exp');
    assertNoRegulated(experience, 'export-reg');
    expect(summary).toMatch(/Zaposlena|apotekar/i);
    expect(summary).toMatch(/Ztrew/);
    expect(summary).toMatch(/dve i po godine iskustva/i);
    expect(summary).not.toMatch(/\. godine,/i);
    expect(summary.match(/godine iskustva/gi)?.length || 0).toBe(1);
    expect(experience).toMatch(/farmac|apotek/i);
    expect(prepared.diagnostics.summaryFactKeysUsed || []).not.toContain(
      'food_preparation_restaurant_standards',
    );

    // Export-only path (no prior Experience apply) must also drop Baker Summary.
    const exportOnly = prepareExportReadyCv(device252Cv(), 'sr', 'modern-minimal', {
      gender: 'female',
      referenceDate: '2026-07-18',
    });
    expect(exportOnly.ok).toBe(true);
    if (exportOnly.ok) {
      assertNoCooking(exportOnly.cv.summary, 'export-only-sum');
      expect(exportOnly.diagnostics.staleSummaryExcluded).toBe(true);
      expect(exportOnly.diagnostics.summaryFactKeysUsed || []).not.toContain(
        'food_preparation_restaurant_standards',
      );
    }

    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const docx = await exportToDOCX(prepared.cv, 'apotekar-252', 'sr', 'modern-minimal');
    expect(pdf).toBeTruthy();
    expect(docx).toBeTruthy();
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    assertNoCooking(pdfText, 'pdf');
    assertNoRegulated(pdfText, 'pdf-reg');
    expect(pdfText).toMatch(/dve i po godine iskustva/i);
    expect(pdfText).not.toMatch(/\. godine,/i);
    expect(getProAiUsageCount()).toBe(usageBeforeExport);
  }, 60_000);

  it('reload of applied CV does not restore Baker Summary facts', () => {
    const ctx = pharmacistCtx();
    const pipeline = runCvAiApplyPipeline({
      cv: device252Cv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
      jobContext: ctx,
      referenceDateIso: '2026-07-18',
    });
    const reloaded = JSON.parse(JSON.stringify(pipeline.stateCv)) as CVData;
    const prepared = prepareExportReadyCv(reloaded, 'sr', 'modern-minimal', {
      gender: 'female',
      referenceDate: '2026-07-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    assertNoCooking(prepared.cv.summary, 'reload-sum');
    assertNoCooking(prepared.cv.experience[0].description, 'reload-exp');
  });

  it('duration composition: no duplicate godine from 2024. year abbreviation', () => {
    const duration = buildExperienceDurationSnapshot(
      [{
        id: 'e',
        company: 'Ztrew',
        position: 'Apotekar',
        startDate: '2024-02',
        endDate: '',
        isPresent: true,
        description: '',
      }],
      '2026-07-18',
    ).total;
    const phrase = formatApproximateDurationPhrase(duration, 'sr');
    expect(phrase).toMatch(/sa oko dve i po godine iskustva/);
    const broken = 'Zaposlena kao apotekar u kompaniji Ztrew od februara 2024. godine, gde priprema jela.';
    const merged = injectDurationPhrase(broken, duration, 'sr');
    const scrubbed = scrubOrphanDurationFragments(merged);
    expect(scrubbed).not.toMatch(/iskustva\.\s*godine/i);
    expect(scrubbed).not.toMatch(/\. godine,/i);

    const safe = buildOccupationAwareSummaryFallback({
      locale: 'sr',
      gender: 'female',
      position: 'Apotekar',
      industry: 'pharmacy',
      company: 'Ztrew',
      startDate: '2024-02',
      durationPhrase: phrase,
      isPresent: true,
    });
    expect(safe).toMatch(/Zaposlena kao apotekarka? u kompaniji Ztrew od februara 2024/i);
    expect(safe).toMatch(/dve i po godine iskustva/);
    expect(safe.match(/godine iskustva/gi)?.length).toBe(1);
    expect(safe).not.toMatch(COOKING_BAN);
    expect(safe).not.toMatch(REGULATED_BAN);
  });

  it('controls: user pharmacist duties preserved; user Summary not silently deleted', () => {
    const userDuties = [
      '• Prima i izdaje lekove prema potvrđenim procedurama apoteke.',
      '• Održava uredan radni prostor i profesionalnu komunikaciju sa klijentima.',
    ].join('\n');
    const cv: CVData = {
      ...device252Cv(),
      summary: 'Ručno napisan rezime apotekarke sa fokusom na tačnost i komunikaciju sa klijentima.',
      summaryOrigin: 'user',
      summaryGenerationContextKey: undefined,
      experience: [{
        ...device252Cv().experience[0],
        description: userDuties,
        originalUserDescription: userDuties,
        canonicalDescription: userDuties,
        descriptionOrigin: 'user',
        groundingRecoverySource: undefined,
        recoveredSemanticDuties: undefined,
        generationJobContextKey: pharmacistCtx().key,
      }],
    };
    const prepared = prepareExportReadyCv(cv, 'sr', 'modern-minimal', {
      gender: 'female',
      referenceDate: '2026-07-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.experience[0].description).toMatch(/izdaje lekove|procedur/i);
    expect(prepared.cv.summary).toMatch(/Ručno napisan|tačnost|komunikacij/i);
  });

  it('control: Pharmacist → Software Developer excludes pharmacy AI duties', () => {
    const pharm = buildOccupationAwareExperienceFallback({
      locale: 'en',
      position: 'Apotekar',
      industry: 'pharmacy',
    });
    const cv: CVData = {
      ...device252Cv(),
      personal: { ...device252Cv().personal, jobTitle: 'Software Developer', gender: 'female' },
      summary: 'Working as pharmacist with pharmacy practice standards.',
      summaryOrigin: 'ai_generated',
      summaryGenerationContextKey: pharmacistCtx().key,
      experience: [{
        id: 'exp-1',
        company: 'Ztrew',
        position: 'Software Developer',
        startDate: '2024-02',
        endDate: '',
        isPresent: true,
        description: pharm,
        descriptionOrigin: 'ai_generated',
        generationJobContextKey: pharmacistCtx().key,
      }],
    };
    const ctx = buildExperienceJobContext({
      position: 'Software Developer',
      industry: 'tech',
      locale: 'en',
      level: 'mid',
    });
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: pharm,
      experienceId: 'exp-1',
      industry: 'tech',
      level: 'mid',
      jobContext: ctx,
    });
    expect(pipeline.stateCv.experience[0].description).not.toMatch(/pharmacy practice|apotek/i);
  });

  it('50× cold Baker→Pharmacist Experience+export: zero flakes', () => {
    const ctx = pharmacistCtx();
    for (let i = 0; i < 50; i += 1) {
      const candidate = i % 3 === 0
        ? SR_REGULATED_PHARMACY
        : i % 3 === 1
          ? [
            '• Priprema jela prema standardima restorana.',
            '• Održava higijenu radnog prostora.',
          ].join('\n')
          : '';
      const pipeline = runCvAiApplyPipeline({
        cv: device252Cv(),
        locale: 'sr',
        action: 'experience_bullets',
        candidate,
        experienceId: 'exp-1',
        industry: 'pharmacy',
        level: 'mid',
        jobContext: ctx,
        referenceDateIso: '2026-07-18',
      });
      expect(pipeline.blocked, `blocked ${i}`).toBe(false);
      const prepared = prepareExportReadyCv(pipeline.stateCv, 'sr', 'modern-minimal', {
        gender: 'female',
        referenceDate: '2026-07-18',
      });
      expect(prepared.ok, `prep ${i}`).toBe(true);
      if (!prepared.ok) return;
      assertNoCooking(prepared.cv.summary, `sum ${i}`);
      assertNoCooking(prepared.cv.experience[0].description, `exp ${i}`);
      assertNoRegulated(prepared.cv.experience[0].description, `reg ${i}`);
      expect(prepared.cv.summary, `dur ${i}`).not.toMatch(/\. godine,/i);
      expect(prepared.cv.summaryGenerationContextKey, `key ${i}`).toBe(ctx.key);
    }
  });
});
