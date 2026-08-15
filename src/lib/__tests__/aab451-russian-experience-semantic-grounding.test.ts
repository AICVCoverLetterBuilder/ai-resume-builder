import { describe, expect, it } from 'vitest';
import {
  buildRussianDesignSemanticFallback,
  sourceRequiresRussianDesignSemanticGrounding,
  validateRussianDesignSemanticProjection,
} from '../cv-russian-experience-semantic-grounding';
import { runCvAiApplyPipeline } from '../cv-ai-finalize-apply';
import { buildExperienceAiOutputProvenance } from '../cv-experience-ai-output-provenance';
import type { CVData } from '../types';

const SOURCE = [
  'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।',
].join('\n');

const SAFE_RUSSIAN = [
  'Создавала графические материалы для печатных и цифровых медиа.',
  'Разрабатывала концепции визуального дизайна в соответствии с потребностями клиентов.',
  'Проверяла дизайн-проекты и контролировала качество конечных результатов.',
].join('\n');

const EQUIVALENT_SOURCES = [
  [
    'Prepared graphic material for print and digital media.',
    'Developed visual design concepts according to customer needs.',
    'Reviewed design projects and checked the quality of final deliverables.',
  ].join('\n'),
  [
    'ग्राफिक सामग्री प्रिंट और डिजिटल मीडिया के लिए तैयार करती थी।',
    'ग्राहक आवश्यकताओं के अनुरूप विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
    'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम परिणामों की गुणवत्ता जाँचती थी।',
  ].join('\n'),
];

const JAPANESE_SOURCE = [
  '\u5370\u5237\u7269\u304a\u3088\u3073\u30c7\u30b8\u30bf\u30eb\u30e1\u30c7\u30a3\u30a2\u5411\u3051\u306e\u30b0\u30e9\u30d5\u30a3\u30c3\u30af\u7d20\u6750\u3092\u4f5c\u6210\u3057\u3066\u3044\u307e\u3057\u305f\u3002',
  '\u30af\u30e9\u30a4\u30a2\u30f3\u30c8\u306e\u30cb\u30fc\u30ba\u306b\u5fdc\u3058\u3066\u30d3\u30b8\u30e5\u30a2\u30eb\u30c7\u30b6\u30a4\u30f3\u306e\u30b3\u30f3\u30bb\u30d7\u30c8\u3092\u958b\u767a\u3057\u3066\u3044\u307e\u3057\u305f\u3002',
  '\u30c7\u30b6\u30a4\u30f3\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3092\u30ec\u30d3\u30e5\u30fc\u3057\u3001\u6700\u7d42\u6210\u679c\u7269\u306e\u54c1\u8cea\u3092\u78ba\u8a8d\u3057\u3066\u3044\u307e\u3057\u305f\u3002',
].join('\n');

const ARABIC_SOURCE = [
  '\u0645\u0648\u0627\u062f \u062a\u0635\u0645\u064a\u0645 \u0631\u0633\u0648\u0645\u064a\u0629 \u0644\u0644\u0645\u0637\u0628\u0648\u0639\u0627\u062a \u0648\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0631\u0642\u0645\u064a\u0629.',
  '\u0645\u0641\u0627\u0647\u064a\u0645 \u0627\u0644\u062a\u0635\u0645\u064a\u0645 \u0627\u0644\u0645\u0631\u0626\u064a \u0648\u062a\u0637\u0648\u064a\u0631\u0647\u0627 \u0648\u0641\u0642\u064b\u0627 \u0644\u0627\u062d\u062a\u064a\u0627\u062c\u0627\u062a \u0627\u0644\u0639\u0645\u0644\u0627\u0621.',
  '\u0645\u0631\u0627\u062c\u0639\u0629 \u0645\u0634\u0627\u0631\u064a\u0639 \u0627\u0644\u062a\u0635\u0645\u064a\u0645 \u0648\u062c\u0648\u062f\u0629 \u0627\u0644\u0645\u062e\u0631\u062c\u0627\u062a \u0627\u0644\u0646\u0647\u0627\u0626\u064a\u0629.',
].join('\n');

const SERBIAN_SOURCE = [
  'Pripremala je grafi\u010dke materijale za \u0161tampane i digitalne medije.',
  'Razvijala je vizuelne koncepte dizajna prema potrebama klijenata.',
  'Pregledala je dizajnerske projekte i proveravala kvalitet kona\u010dnih rezultata.',
].join('\n');

describe('AAB451 Russian Experience source-owned semantic grounding', () => {
  it('projects every immutable completed-role design responsibility one-for-one', () => {
    expect(sourceRequiresRussianDesignSemanticGrounding(SOURCE)).toBe(true);
    const candidate = buildRussianDesignSemanticFallback({
      sourceDescription: SOURCE,
      isPresent: false,
      gender: 'female',
    });
    expect(candidate).toContain('печатных и цифровых медиа');
    expect(candidate).toContain('потребностями клиентов');
    expect(candidate).toContain('качество конечных результатов');
    const coverage = validateRussianDesignSemanticProjection(SOURCE, candidate);
    expect(coverage).toMatchObject({ ok: true, required: [
      'graphic_materials_media',
      'visual_concepts_client_needs',
      'design_review_final_quality',
    ], covered: [
      'graphic_materials_media',
      'visual_concepts_client_needs',
      'design_review_final_quality',
    ], addedSemanticArgumentCount: 0 });
  });

  it.each([
    'Создавала графические материалы для цифровых медиа.\nРазрабатывала концепции визуального дизайна в соответствии с потребностями клиентов.\nПроверяла дизайн-проекты и контролировала качество конечных результатов.',
    'Создавала графические материалы для печатных и цифровых медиа.\nРазрабатывала концепции визуального дизайна в соответствии с требованиями проекта.\nПроверяла дизайн-проекты и контролировала качество конечных результатов.',
    'Создавала графические материалы для печатных и цифровых медиа.\nРазрабатывала концепции визуального дизайна в соответствии с потребностями клиентов.\nПодготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
    'Создавала графические материалы для печатных и цифровых медиа на платформах.\nРазрабатывала концепции визуального дизайна в соответствии с потребностями клиентов.\nПроверяла дизайн-проекты и контролировала качество конечных результатов.',
  ])('rejects missing, substituted, or unsourced semantic arguments', (candidate) => {
    expect(validateRussianDesignSemanticProjection(SOURCE, candidate).ok).toBe(false);
  });

  it('rejects a semantic duty leaked from another Experience entry', () => {
    const leaked = `${SAFE_RUSSIAN}\nÐ¡Ð¾Ð³Ð»Ð°ÑÐ¾Ð²Ñ‹Ð²Ð°Ð»Ð° Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ñ ÐºÐ¾Ð¼Ð°Ð½Ð´Ð¾Ð¹ Ð´Ñ€ÑƒÐ³Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐºÑ‚Ð°.`;
    expect(validateRussianDesignSemanticProjection(SOURCE, leaked)).toMatchObject({
      ok: false,
      addedSemanticArgumentCount: 1,
      reason: 'russian_design_unsupported_semantic_argument',
    });
  });

  it.each(EQUIVALENT_SOURCES)(
    'projects equivalent immutable facts without using the role title as authority',
    (source) => {
      expect(sourceRequiresRussianDesignSemanticGrounding(source)).toBe(true);
      const fallback = buildRussianDesignSemanticFallback({
        sourceDescription: source,
        isPresent: false,
        gender: 'female',
      });
      expect(validateRussianDesignSemanticProjection(source, fallback)).toMatchObject({
        ok: true,
        required: ['graphic_materials_media', 'visual_concepts_client_needs', 'design_review_final_quality'],
        covered: ['graphic_materials_media', 'visual_concepts_client_needs', 'design_review_final_quality'],
      });
    },
  );

  it.each([
    ['Japanese', JAPANESE_SOURCE],
    ['Arabic', ARABIC_SOURCE],
    ['Serbian', SERBIAN_SOURCE],
  ])('projects completed female %s source facts to Russian with no extra semantic unit', (_language, source) => {
    expect(sourceRequiresRussianDesignSemanticGrounding(source)).toBe(true);
    const candidate = buildRussianDesignSemanticFallback({
      sourceDescription: source,
      isPresent: false,
      gender: 'female',
    });
    expect(validateRussianDesignSemanticProjection(source, candidate)).toMatchObject({
      ok: true,
      required: ['graphic_materials_media', 'visual_concepts_client_needs', 'design_review_final_quality'],
      covered: ['graphic_materials_media', 'visual_concepts_client_needs', 'design_review_final_quality'],
      uncovered: [],
      addedSemanticArgumentCount: 0,
    });
    expect(candidate).toMatch(/^[\p{Script=Cyrillic}\s•.,-]+$/u);
    expect(candidate).toContain('\u0421\u043e\u0437\u0434\u0430\u0432\u0430\u043b\u0430');
    expect(candidate).toContain('\u0420\u0430\u0437\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u043b\u0430');
    expect(candidate).toContain('\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u043b\u0430');
  });

  it('accepts a source-grounded provider candidate without mislabelling it as fallback', () => {
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'fnv1a_be5c794b_l36_b100_e52',
      appliedOutput: 'Предыдущий ИИ-текст.',
      preAiFactText: SOURCE,
      sourceLocale: 'hi',
      targetLocale: 'ru',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'original_user',
    });
    const cv = {
      personal: { fullName: 'Test', email: '', phone: '', location: '', jobTitle: 'Any free-text title', gender: 'female' },
      summary: '', education: [], skills: [], languages: [], certifications: [], customSections: [],
      experience: [{
        id: 'fnv1a_be5c794b_l36_b100_e52', position: 'Any free-text title', company: 'TestWerk',
        startDate: '2024-01', endDate: '2026-02', isPresent: false,
        description: 'Предыдущий ИИ-текст.', originalUserDescription: SOURCE, canonicalDescription: SOURCE,
        descriptionOrigin: 'ai_generated', generatedDescription: 'Предыдущий ИИ-текст.', generatedLocale: 'ru',
        aiOutputProvenance: provenance,
      }],
    } as unknown as CVData;
    const pipeline = runCvAiApplyPipeline({
      cv, locale: 'ru', action: 'experience_bullets', candidate: SAFE_RUSSIAN,
      experienceId: 'fnv1a_be5c794b_l36_b100_e52',
    });
    expect(pipeline.finalized).toMatchObject({
      blocked: false,
      countedAsSuccess: true,
      origin: 'ai_generated',
    });
    expect(pipeline.finalized.text).toContain('печатных и цифровых медиа');
    expect(pipeline.finalized.diagnostics?.finalCandidateSource).toBe('provider');
    expect(pipeline.finalized.diagnostics?.providerCandidateValidationAccepted).toBe(true);
    expect(pipeline.finalized.diagnostics?.finalCandidateValidationAccepted).toBe(true);
  });

  it('rejects the provider shell and applies only the immutable-fact fallback once', () => {
    const poisonedProvider = [
      'Создавала визуальные материалы для цифровых продуктов и платформ.',
      'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
      'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
    ].join('\n');
    const cv = {
      personal: { fullName: 'Test', email: '', phone: '', location: '', jobTitle: 'Свободное название роли', gender: 'female' },
      summary: '', education: [], skills: [], languages: [], certifications: [], customSections: [],
      experience: [{
        id: 'fnv1a_be5c794b_l36_b100_e52', position: 'Свободное название роли', company: 'TestWerk',
        startDate: '2024-01', endDate: '2026-02', isPresent: false,
        description: poisonedProvider, originalUserDescription: SOURCE, canonicalDescription: SOURCE,
        descriptionOrigin: 'ai_generated', generatedDescription: poisonedProvider, generatedLocale: 'ru',
        aiOutputProvenance: buildExperienceAiOutputProvenance({
          experienceEntryId: 'fnv1a_be5c794b_l36_b100_e52', appliedOutput: poisonedProvider,
          preAiFactText: SOURCE, sourceLocale: 'hi', targetLocale: 'ru',
          operationMode: 'enhance_existing', sourceAuthorityKind: 'original_user',
        }),
      }],
    } as unknown as CVData;
    const pipeline = runCvAiApplyPipeline({
      cv, locale: 'ru', action: 'experience_bullets', candidate: poisonedProvider,
      experienceId: 'fnv1a_be5c794b_l36_b100_e52',
    });
    expect(pipeline.finalized.blocked).toBe(false);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    expect(pipeline.finalized.origin).toBe('deterministic_fallback');
    expect(pipeline.finalized.text).toContain('печатных и цифровых медиа');
    expect(pipeline.finalized.text).toContain('потребностями клиентов');
    expect(pipeline.finalized.text).toContain('качество конечных результатов');
    expect(pipeline.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(pipeline.finalized.diagnostics?.providerPrimaryCandidateValidationAccepted).toBe(false);
    expect(pipeline.finalized.diagnostics?.providerCandidateValidationAccepted).toBe(false);
    expect(pipeline.finalized.diagnostics?.finalCandidateValidationAccepted).toBe(true);
    expect(pipeline.finalized.diagnostics?.authoritativeRequiredFamilyCount).toBe(3);
    expect(pipeline.finalized.diagnostics?.finalSelectedCoveredFamilyCount).toBe(3);
  });
});
