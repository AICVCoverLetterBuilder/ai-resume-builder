/**
 * Build 273: empty-source Hindi Experience generation for free-text
 * `Grafički dizajner` (completed, female, General, Mid).
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import type { Locale } from '../i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from '../cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import {
  buildJobContextGenerationFallback,
  resolveExperienceAiOperationMode,
  validateExperienceGenerationOutput,
} from '../cv-experience-ai-operation-mode';
import {
  classifyFreeTextJobDomain,
  textLooksRelevantToFreeTextTitle,
} from '../cv-ai-operation-contract';
import {
  detectAiContentScript,
  resolveTargetScriptForLocale,
  validateAiUnitLocalePurity,
} from '../cv-ai-unit-locale-purity';
import { textMatchesRequestedFieldLocale } from '../cv-field-locale-integrity';
import { isWrongLanguageAiOutput } from '../cv-ai-locale-guard';

const TITLE = 'Grafički dizajner';

const HI_DESIGN_VALID = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
]);

const HI_MIXED_TITLE = formatExperienceBullets([
  `${TITLE} से जुड़े दृश्य कार्यों की समीक्षा की।`,
  'विभिन्न परियोजनाओं के लिए ग्राफिक तत्व तैयार किए।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं।',
]);

const HI_MIXED_EN = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'Created visual materials and graphic elements for digital products.',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
]);

const HI_WAREHOUSE_LEAK = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
]);

function emptyDesignerCv(): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      location: 'Beograd',
      jobTitle: TITLE,
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'exp-gd-empty-hi',
        position: TITLE,
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: '',
        descriptionOrigin: 'user',
        generatedLocale: 'en',
        // Stale AI noise must be ignored for empty generation.
        generatedDescription: 'Stale English bullets about warehouse delivery.',
        canonicalDescription: '',
        originalUserDescription: '',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'en',
  };
}

describe('build 273 empty Hindi graphic-designer generation', () => {
  it('classifies design domain and never injects Serbian title into Hindi', () => {
    expect(classifyFreeTextJobDomain(TITLE)).toBe('design');
    expect(resolveExperienceAiOperationMode('')).toBe('generate_from_job_context');
    expect(resolveTargetScriptForLocale('hi')).toBe('devanagari');

    const fb = buildJobContextGenerationFallback({
      locale: 'hi',
      gender: 'female',
      position: TITLE,
      industry: 'general',
      isPresent: false,
    });
    expect(fb.trim()).toBeTruthy();
    expect(fb).not.toMatch(/Grafički|dizajner|Proverava|warehouse|robu|isporuč/i);
    expect(fb).toMatch(/दृश्य|ग्राफिक|डिज़ाइन/);
    expect(textMatchesRequestedFieldLocale(fb, 'hi', 'experience_bullet')).toBe(true);
    expect(isWrongLanguageAiOutput(fb, 'hi')).toBe(false);
    expect(validateAiUnitLocalePurity(fb, 'hi', { kind: 'experience_bullet', requireUnits: true }).ok).toBe(true);
    expect(textLooksRelevantToFreeTextTitle(fb, TITLE)).toBe(true);
    expect(validateExperienceGenerationOutput(fb, {
      locale: 'hi',
      position: TITLE,
      isPresent: false,
    }).ok).toBe(true);
    expect(splitExperienceBullets(fb)).toHaveLength(3);
    expect(detectAiContentScript(HI_MIXED_TITLE.split('\n')[0])).toBe('mixed');
  });

  it('50× empty-source Hindi design generation applies +1, locale hi, restart-safe', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = emptyDesignerCv();
      expect(resolveExperienceAiOperationMode(cv.experience![0].description)).toBe('generate_from_job_context');

      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'hi',
        action: 'experience_bullets',
        candidate: HI_MIXED_TITLE, // impure server-like fallback → client repairs
        experienceId: 'exp-gd-empty-hi',
        industry: 'general',
        level: 'mid',
      });
      expect(pipe.blocked, `iter ${i} ${pipe.reason}`).toBe(false);
      expect(pipe.finalized.countedAsSuccess).toBe(true);
      const text = pipe.finalized.text;
      expect(splitExperienceBullets(text)).toHaveLength(3);
      expect(validateAiUnitLocalePurity(text, 'hi', { kind: 'experience_bullet', requireUnits: true }).ok).toBe(true);
      expect(text).toMatch(/दृश्य|ग्राफिक|डिज़ाइन/);
      expect(text).not.toMatch(/Grafički|warehouse|robu|माल और|गोदाम/i);
      expect(pipe.stateCv.contentLocale).toBe('hi');
      expect(pipe.stateCv.experience![0].generatedLocale).toBe('hi');
      expect(pipe.stateCv.experience![0].description).toBe(text);
      // Usage policy: successful visible apply counts exactly once (caller increments).
      expect(pipe.finalized.diagnostics?.countedAsSuccess).toBe(true);

      const reloaded = structuredClone(pipe.stateCv);
      expect(reloaded.contentLocale).toBe('hi');
      expect(reloaded.experience![0].generatedLocale).toBe('hi');
      expect(reloaded.experience![0].description).toBe(text);
    }
  });

  it('failure matrix: accept valid / repair mixed / reject unsafe patterns', () => {
    const cv = emptyDesignerCv();

    const ok = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_DESIGN_VALID,
      experienceId: 'exp-gd-empty-hi',
      industry: 'general',
      level: 'mid',
    });
    expect(ok.blocked).toBe(false);
    expect(ok.countedAsSuccess).toBe(true);
    expect(ok.origin).toBe('ai_generated');

    const mixedTitle = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_MIXED_TITLE,
      experienceId: 'exp-gd-empty-hi',
      industry: 'general',
      level: 'mid',
      originHint: 'deterministic_fallback',
    });
    expect(mixedTitle.blocked).toBe(false);
    expect(mixedTitle.text).not.toMatch(/Grafički/);
    expect(mixedTitle.origin).toBe('deterministic_fallback');

    const mixedEn = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_MIXED_EN,
      experienceId: 'exp-gd-empty-hi',
      industry: 'general',
      level: 'mid',
    });
    expect(mixedEn.blocked).toBe(false);
    expect(mixedEn.text).not.toMatch(/Created visual|graphic elements/i);
    expect(validateAiUnitLocalePurity(mixedEn.text, 'hi', {
      kind: 'experience_bullet',
      requireUnits: true,
    }).ok).toBe(true);

    const warehouse = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_WAREHOUSE_LEAK,
      experienceId: 'exp-gd-empty-hi',
      industry: 'general',
      level: 'mid',
    });
    // Either reject or repair away from warehouse duties.
    if (!warehouse.blocked && warehouse.countedAsSuccess) {
      expect(warehouse.text).not.toMatch(/माल और|गोदाम|आवाजाही/);
      expect(warehouse.text).toMatch(/दृश्य|ग्राफिक|डिज़ाइन/);
    } else {
      expect(warehouse.countedAsSuccess).toBe(false);
    }

    const empty = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: '',
      experienceId: 'exp-gd-empty-hi',
      industry: 'general',
      level: 'mid',
    });
    expect(empty.blocked).toBe(false);
    expect(empty.origin).toBe('deterministic_fallback');
    expect(splitExperienceBullets(empty.text)).toHaveLength(3);
    expect(empty.diagnostics?.generationFallbackFailureReason).toBeFalsy();
  });

  it('universal empty generation matrix (locales × free-text title)', () => {
    const locales: Locale[] = [
      'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
    ];
    const titles = [TITLE, 'Customer Support Specialist', 'Radnica u skladištu', 'Unknown Role XYZ'];
    for (const locale of locales) {
      for (const position of titles) {
        for (const isPresent of [true, false]) {
          const out = buildJobContextGenerationFallback({
            locale,
            gender: 'female',
            position,
            industry: 'general',
            isPresent,
          });
          expect(out.trim(), `${locale}/${position}`).toBeTruthy();
          expect(splitExperienceBullets(out).length, `${locale}/${position}`).toBe(3);
          expect(
            validateExperienceGenerationOutput(out, { locale, position, isPresent }).ok,
            `${locale}/${position} gen`,
          ).toBe(true);
          if (locale === 'hi') {
            expect(out).not.toMatch(/[A-Za-zÀ-ÖØ-öø-ÿŠšŽžĆćČčĐđ]{4,}/);
            expect(validateAiUnitLocalePurity(out, 'hi', {
              kind: 'experience_bullet',
              requireUnits: true,
            }).ok).toBe(true);
          }
          if (locale === 'ar' || locale === 'ja' || locale === 'ru') {
            expect(isWrongLanguageAiOutput(out, locale)).toBe(false);
          }
        }
      }
    }
  });
});
