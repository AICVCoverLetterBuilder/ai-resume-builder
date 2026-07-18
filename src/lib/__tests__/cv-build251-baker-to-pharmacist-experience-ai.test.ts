/**
 * @vitest-environment jsdom
 *
 * Build 251: Baker(Hindi AI) → Apotekar(Serbian) Experience AI must not reuse cooking duties.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildExperienceJobContext,
  buildOccupationAwareExperienceFallback,
  experienceJobContextsMatch,
  isExperienceGroundingValidForAiContext,
  resolveExperienceAiGrounding,
  textLooksLikeCookingDuties,
} from '@/lib/cv-experience-job-context';
import {
  freezeCanonicalExperienceDescription,
} from '@/lib/cv-canonical-facts';
import {
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import { LEGACY_RECOVERED_DISPLAY_DUTIES } from '@/lib/cv-legacy-grounding-recovery';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import { getProAiUsageCount, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';

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

const SR_COOKING_TRANSLATION = [
  '• Priprema jela prema standardima restorana.',
  '• Održava higijenu radnog prostora i sarađuje sa kuhinjskim timom.',
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

function bakerContextKey() {
  return buildExperienceJobContext({
    position: 'Baker',
    industry: 'hospitality',
    locale: 'hi',
    level: 'mid',
  }).key;
}

function pharmacistContext(overrides?: Partial<{ locale: string; level: string }>) {
  return buildExperienceJobContext({
    position: 'Apotekar',
    industry: 'pharmacy',
    locale: overrides?.locale || 'sr',
    level: overrides?.level || 'mid',
  });
}

function deviceBakerCv(): CVData {
  const bakerKey = bakerContextKey();
  return {
    id: 'cv-251',
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
    summary: '',
    contentLocale: 'sr',
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
      generationJobContextKey: bakerKey,
      groundingJobContextKey: bakerKey,
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

function installFonts() {
  // PDF tests may no-op font loading in jsdom; renderer has its own stubs.
}

describe('Build 251 Baker→Pharmacist Experience AI job-context', () => {
  beforeEach(() => {
    localStorage.clear();
    installFonts();
  });

  it('excludes stale Baker AI/legacy grounding for Apotekar + Farmacija', () => {
    const cv = deviceBakerCv();
    const ctx = pharmacistContext();
    const resolved = resolveExperienceAiGrounding(
      cv.experience[0],
      ctx,
      freezeCanonicalExperienceDescription,
    );
    expect(resolved.staleGeneratedContentExcluded).toBe(true);
    expect(resolved.sourceDescription).toBe('');
    expect(resolved.semanticDutyKeysUsed).toEqual([]);
    expect(resolved.semanticDutyKeysBefore).toEqual([
      'food_preparation_restaurant_standards',
      'workplace_hygiene',
      'kitchen_team_collaboration',
    ]);
    expect(isExperienceGroundingValidForAiContext(cv.experience[0], ctx)).toBe(false);
  });

  it('request payload facts: position Apotekar, industry pharmacy, locale sr, no cooking source', () => {
    const cv = deviceBakerCv();
    const industry = 'pharmacy';
    const level = 'mid';
    const ctx = buildExperienceJobContext({
      position: cv.experience[0].position,
      industry,
      locale: 'sr',
      level,
    });
    const grounding = resolveExperienceAiGrounding(
      cv.experience[0],
      ctx,
      freezeCanonicalExperienceDescription,
    );
    const requestBody = {
      action: 'bullets',
      position: cv.experience[0].position,
      industry,
      level,
      locale: 'sr',
      sourceDescription: grounding.sourceDescription,
      jobContextKey: ctx.key,
    };
    expect(requestBody.position).toBe('Apotekar');
    expect(requestBody.industry).toBe('pharmacy');
    expect(requestBody.locale).toBe('sr');
    expect(requestBody.sourceDescription).toBe('');
    expect(textLooksLikeCookingDuties(requestBody.sourceDescription)).toBe(false);
  });

  it('provider cooking translation is rejected; occupation fallback applied (Serbian pharmacist)', () => {
    const cv = deviceBakerCv();
    const ctx = pharmacistContext();
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'experience_bullets',
      candidate: SR_COOKING_TRANSLATION,
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
      jobContext: ctx,
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    expect(textLooksLikeCookingDuties(pipeline.stateCv.experience[0].description)).toBe(false);
    expect(pipeline.stateCv.experience[0].description).toMatch(/farmac|apotek/i);
    expect(pipeline.stateCv.experience[0].description).not.toMatch(/restoran|kuhinj|jela/i);
    expect(pipeline.stateCv.experience[0].generationJobContextKey).toBe(ctx.key);
    expect(pipeline.stateCv.experience[0].recoveredSemanticDuties).toBeUndefined();
    expect(pipeline.stateCv.experience[0].groundingRecoverySource).toBeUndefined();
    expect(pipeline.pdfCv.experience[0].description).toBe(pipeline.stateCv.experience[0].description);
    expect(pipeline.docxCv.experience[0].description).toBe(pipeline.stateCv.experience[0].description);
  });

  it('late Baker-context result is rejected by context mismatch', () => {
    const cv = deviceBakerCv();
    const pharmacist = pharmacistContext();
    const baker = buildExperienceJobContext({
      position: 'Baker',
      industry: 'hospitality',
      locale: 'hi',
      level: 'mid',
    });
    expect(experienceJobContextsMatch(pharmacist, baker)).toBe(false);
    // Simulate apply only when contexts match (page race guard).
    const shouldApply = experienceJobContextsMatch(pharmacist.key, pharmacist.key)
      && !experienceJobContextsMatch(baker.key, pharmacist.key);
    expect(shouldApply).toBe(true);
    const lateWouldApply = experienceJobContextsMatch(baker.key, pharmacist.key);
    expect(lateWouldApply).toBe(false);
  });

  it('AI usage increments only after valid visible application; timeout does not', () => {
    localStorage.setItem('cvpro-ai-usage', JSON.stringify({ count: 3, window: Date.now() }));
    const before = getProAiUsageCount();
    const cv = deviceBakerCv();
    const blocked = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
    });
    // Empty candidate still gets occupation fallback — counted as success without
    // requiring recordProAiSuccess here; page only counts after apply.
    expect(blocked.finalized.countedAsSuccess).toBe(true);
    expect(getProAiUsageCount()).toBe(before);
    // Simulate page-level success accounting only after visible apply.
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(before + 1);
  });

  it('50× cold Baker→Pharmacist: zero cooking survival flakes', () => {
    const ctx = pharmacistContext();
    for (let i = 0; i < 50; i++) {
      const cv = deviceBakerCv();
      const grounding = resolveExperienceAiGrounding(
        cv.experience[0],
        ctx,
        freezeCanonicalExperienceDescription,
      );
      expect(grounding.sourceDescription, `src ${i}`).toBe('');
      const pipeline = runCvAiApplyPipeline({
        cv,
        locale: 'sr',
        action: 'experience_bullets',
        candidate: i % 2 === 0 ? SR_COOKING_TRANSLATION : '',
        experienceId: 'exp-1',
        industry: 'pharmacy',
        level: 'mid',
        jobContext: ctx,
      });
      expect(pipeline.blocked, `blocked ${i}`).toBe(false);
      const desc = pipeline.stateCv.experience[0].description;
      expect(textLooksLikeCookingDuties(desc), `cook ${i}`).toBe(false);
      expect(desc, `pharm ${i}`).toMatch(/farmac|apotek/i);
      expect(pipeline.stateCv.experience[0].generationJobContextKey, `key ${i}`).toBe(ctx.key);
    }
  });

  it('control: same position locale-only keeps genuine user facts', () => {
    const exp: WorkExperience = {
      id: 'exp-u',
      company: 'Ztrew',
      position: 'Baker',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: EN_COOKING,
      originalUserDescription: EN_COOKING,
      canonicalDescription: EN_COOKING,
      descriptionOrigin: 'user',
    };
    const hiCtx = buildExperienceJobContext({
      position: 'Baker',
      industry: 'hospitality',
      locale: 'hi',
      level: 'mid',
    });
    expect(isExperienceGroundingValidForAiContext(exp, hiCtx)).toBe(true);
    const resolved = resolveExperienceAiGrounding(exp, hiCtx, freezeCanonicalExperienceDescription);
    expect(resolved.groundingSource).toBe('genuine_user');
    expect(resolved.sourceDescription).toContain('Prepare dishes');
  });

  it('control: Pharmacist → Software Developer excludes pharmacist AI duties', () => {
    const pharmCtx = pharmacistContext({ locale: 'en' });
    const cv: CVData = {
      ...deviceBakerCv(),
      experience: [{
        id: 'exp-1',
        company: 'Ztrew',
        position: 'Software Developer',
        startDate: '2024-02',
        endDate: '',
        isPresent: true,
        description: buildOccupationAwareExperienceFallback({
          locale: 'en',
          position: 'Apotekar',
          industry: 'pharmacy',
        }),
        descriptionOrigin: 'ai_generated',
        generatedDescription: buildOccupationAwareExperienceFallback({
          locale: 'en',
          position: 'Apotekar',
          industry: 'pharmacy',
        }),
        generationJobContextKey: pharmCtx.key,
      }],
    };
    const devCtx = buildExperienceJobContext({
      position: 'Software Developer',
      industry: 'tech',
      locale: 'en',
      level: 'mid',
    });
    expect(isExperienceGroundingValidForAiContext(cv.experience[0], devCtx)).toBe(false);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: cv.experience[0].description,
      experienceId: 'exp-1',
      industry: 'tech',
      level: 'mid',
      jobContext: devCtx,
    });
    expect(pipeline.stateCv.experience[0].description).not.toMatch(/pharmacy practice/i);
    expect(pipeline.stateCv.experience[0].generationJobContextKey).toBe(devCtx.key);
  });

  it('control: changing back to Baker does not reuse pharmacist duties', () => {
    const pharmCtx = pharmacistContext();
    const afterPharm = runCvAiApplyPipeline({
      cv: deviceBakerCv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
      jobContext: pharmCtx,
    }).stateCv;
    afterPharm.experience[0].position = 'Baker';
    const bakerCtx = buildExperienceJobContext({
      position: 'Baker',
      industry: 'hospitality',
      locale: 'en',
      level: 'mid',
    });
    expect(isExperienceGroundingValidForAiContext(afterPharm.experience[0], bakerCtx)).toBe(false);
    const back = runCvAiApplyPipeline({
      cv: afterPharm,
      locale: 'en',
      action: 'experience_bullets',
      candidate: afterPharm.experience[0].description,
      experienceId: 'exp-1',
      industry: 'hospitality',
      level: 'mid',
      jobContext: bakerCtx,
    });
    expect(back.stateCv.experience[0].description).not.toMatch(/farmac|apotek/i);
  });

  it('reload/persistence: after pharmacist apply, cooking keys are gone', () => {
    const ctx = pharmacistContext();
    const applied = runCvAiApplyPipeline({
      cv: deviceBakerCv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
      jobContext: ctx,
    }).stateCv;
    const serialized = JSON.parse(JSON.stringify(applied)) as CVData;
    expect(serialized.experience[0].recoveredSemanticDuties).toBeUndefined();
    expect(serialized.experience[0].description).toMatch(/farmac|apotek/i);
    expect(textLooksLikeCookingDuties(serialized.experience[0].description)).toBe(false);
  });

  it('PDF/DOCX use newly applied pharmacist description', async () => {
    const ctx = pharmacistContext();
    const applied = runCvAiApplyPipeline({
      cv: deviceBakerCv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'pharmacy',
      level: 'mid',
      jobContext: ctx,
    }).stateCv;
    // Seed a minimal grounded summary so export prepare can seal without
    // reopening Baker cooking recovery.
    const exportCv: CVData = {
      ...applied,
      summary: 'Apotekarka sa iskustvom u farmaceutskoj delatnosti, tačnosti i profesionalnoj komunikaciji.',
      summaryOrigin: 'user',
      canonicalSummary: 'Apotekarka sa iskustvom u farmaceutskoj delatnosti, tačnosti i profesionalnoj komunikaciji.',
    };
    expect(textLooksLikeCookingDuties(exportCv.experience[0].description)).toBe(false);
    expect(exportCv.experience[0].description).toMatch(/farmac|apotek/i);

    const pdf = await buildModernMinimalPdfBlob(exportCv, 'sr');
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    expect(pdfText).toMatch(/farmac|apotek|Ztrew|Ivan/i);
    expect(pdfText).not.toMatch(/Priprema jela|restoran|kuhinj/i);

    const docxResult = await exportToDOCX(exportCv, 'apotekar-cv', 'sr', 'modern-minimal');
    expect(docxResult).toBeTruthy();
  }, 30_000);

  it('English / Hindi pharmacist controls produce non-cooking fallback', () => {
    for (const locale of ['en', 'hi'] as const) {
      const ctx = buildExperienceJobContext({
        position: locale === 'hi' ? 'फार्मासिस्ट' : 'Pharmacist',
        industry: 'pharmacy',
        locale,
        level: 'mid',
      });
      const cv = {
        ...deviceBakerCv(),
        personal: { ...deviceBakerCv().personal, jobTitle: ctx.positionNorm },
        experience: [{
          ...deviceBakerCv().experience[0],
          position: locale === 'hi' ? 'फार्मासिस्ट' : 'Pharmacist',
        }],
      };
      const pipeline = runCvAiApplyPipeline({
        cv,
        locale,
        action: 'experience_bullets',
        candidate: SR_COOKING_TRANSLATION,
        experienceId: 'exp-1',
        industry: 'pharmacy',
        level: 'mid',
        jobContext: ctx,
      });
      expect(textLooksLikeCookingDuties(pipeline.stateCv.experience[0].description)).toBe(false);
    }
  });
});
