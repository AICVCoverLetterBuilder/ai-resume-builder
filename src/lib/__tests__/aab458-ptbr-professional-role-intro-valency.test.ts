import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  projectLocalizedSummaryV2Manifest,
  runSummaryV2,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import {
  evaluateSummaryV2NativeSurface,
  evaluateNativeRealizationContract,
} from '@/lib/cv-summary-v2/native-surface';
import { evaluateSummaryV2StyleFulfillment } from '@/lib/cv-summary-v2/rewrite-style';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';

const REF = '2026-07-01';

function cvForDevice(): CVData {
  const current: WorkExperience = {
    id: '90ceb215',
    position: 'مصممة جرافيك',
    company: 'Rewitu Current Test',
    startDate: '2026-03',
    endDate: '',
    isPresent: true,
    description: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.',
    originalUserDescription: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.',
    descriptionOrigin: 'user',
  } as WorkExperience;
  const prior: WorkExperience = applyGeneratedExperienceDescription({
    id: 'be5c794b',
    position: 'ग्राफिक डिज़ाइनर',
    company: 'TestWerk GmbH',
    startDate: '2020-09',
    endDate: '2024-01',
    isPresent: false,
    description: 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।',
    originalUserDescription: 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।',
    descriptionOrigin: 'user',
  } as WorkExperience, 'Criou materiais gráficos para mídias impressas e digitais.\nDesenvolveu conceitos de design visual de acordo com as necessidades dos clientes.\nRevisou projetos de design e verificou a qualidade dos resultados finais.', {
    locale: 'pt-BR',
    sourceLocale: 'hi',
    origin: 'ai_generated',
    operationMode: 'generate_from_context',
    requestHash: 'aab458-device',
  });
  const older: WorkExperience = {
    id: 'a221433',
    position: 'مصممة جرافيك',
    company: 'Rewitu',
    startDate: '2017-03',
    endDate: '2020-09',
    isPresent: false,
    description: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.',
    originalUserDescription: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.',
    descriptionOrigin: 'user',
  } as WorkExperience;
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' },
    experience: [current, prior, older],
    education: [],
    skills: [],
    languages: [],
    summary: '',
    contentLocale: 'pt-BR',
  } as unknown as CVData;
}

async function localizedDeviceManifest(cv: CVData) {
  const manifest = buildSummaryV2ManifestForCv({
    cv,
    locale: 'pt-BR',
    gender: 'female',
    referenceDateIso: REF,
  });
  return localizeSummaryV2Manifest({
    manifest,
    transport: async (input) => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: 'Designer Gráfica',
        facts: entry.facts.map((fact, index) => ({
          factId: fact.factId,
          localizedText: entry.entryId === '90ceb215'
            ? [
              'Elabora conceitos visuais e layouts para materiais digitais.',
              'Edita gráficos e imagens para diversos projetos.',
              'Coordena rascunhos e revisões com os membros da equipe do projeto.',
            ][index]!
            : entry.entryId === 'be5c794b'
              ? [
              'Criou materiais gráficos para mídias impressas e digitais.',
              'Desenvolveu conceitos de design visual de acordo com as necessidades dos clientes.',
              'Revisou projetos de design e verificou a qualidade dos resultados finais.',
              ][index]!
              : [
                'Elaborou conceitos visuais e layouts para materiais digitais.',
                'Editou ilustrações e imagens para diversos projetos.',
                'Coordenou rascunhos e revisões com os membros da equipe do projeto.',
              ][index]!,
        })),
      })),
    }),
  });
}

describe('AAB458 PT-BR Professional role-intro valency', () => {
  it('replays the AAB457 device surface with native atuar role introductions', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const cv = cvForDevice();
    const localized = await localizedDeviceManifest(cv);
    const generated = runSummaryV2({
      cv,
      locale: 'pt-BR',
      gender: 'female',
      candidate: '',
      referenceDateIso: REF,
      localizedManifest: localized.manifest,
    });
    const professional = runSummaryV2({
      cv: { ...cv, summary: generated.text } as CVData,
      locale: 'pt-BR',
      gender: 'female',
      candidate: '',
      referenceDateIso: REF,
      localizedManifest: localized.manifest,
      rewriteStyle: 'professional',
    });

    expect(generated.countedAsSuccess, generated.reason).toBe(true);
    expect(professional.blocked, professional.reason).toBe(false);
    expect(professional.countedAsSuccess).toBe(true);
    expect(professional.text).toContain('Atualmente atuo como Designer Gráfica');
    expect(professional.text).toContain('Anteriormente atuei como Designer Gráfica');
    expect(professional.text).not.toMatch(/\b(?:exerço|exerci)\s+como\b/iu);
    expect(professional.validation.requiredCurrentFactCount).toBe(3);
    expect(professional.validation.coveredCurrentFactCount).toBe(3);
    expect(professional.validation.requiredPriorFactCount).toBe(6);
    expect(professional.validation.coveredPriorFactCount).toBe(6);
    expect(professional.validation.targetLocalePurityPassed).toBe(true);
  });

  it.each([
    ['exerço como Designer', 'Atualmente exerço como Designer Gráfica na Empresa, onde elaboro materiais.'],
    ['exerci como Desenvolvedora Backend', 'Anteriormente exerci como Desenvolvedora Backend na Empresa, onde desenvolvi sistemas.'],
    ['exerce como Engenheiro', 'Atualmente exerce como Engenheiro na Empresa, onde coordeno projetos.'],
    ['exerceu como Analista', 'Anteriormente exerceu como Analista na Empresa, onde analisei dados.'],
  ])('rejects bare exercer role-intro valency (%s)', (_label, text) => {
    const contract = evaluateNativeRealizationContract({ text, locale: 'pt-BR' });
    const native = evaluateSummaryV2NativeSurface({ text, locale: 'pt-BR' });
    expect(contract.localeVerbMorphologyPassed).toBe(false);
    expect(contract.nativeRealizationRejectionReasons).toContain(
      'locale_verb_morphology:ptbr_invalid_role_intro_valency',
    );
    expect(native.nativeSurfaceValidationPassed).toBe(false);
    expect(native.localeVerbMorphologyPassed).toBe(false);
  });

  it.each([
    'Atualmente atuo como Operadora de Máquina na Empresa, onde elaboro relatórios.',
    'Anteriormente atuei como Desenvolvedora Backend na Empresa, onde desenvolvi sistemas.',
    'Atualmente exerço a função de Especialista de Suporte na Empresa, onde resolvo solicitações.',
    'Anteriormente exerci a função de Analista na Empresa, onde analisei dados.',
    'Atualmente trabalho como Coordenadora de Projetos na Empresa, onde coordeno entregas.',
    'Anteriormente trabalhei como Pesquisadora na Empresa, onde revisei estudos.',
  ])('accepts native arbitrary role-intro valency: %s', (text) => {
    const contract = evaluateNativeRealizationContract({ text, locale: 'pt-BR' });
    const native = evaluateSummaryV2NativeSurface({ text, locale: 'pt-BR' });
    expect(contract.localeVerbMorphologyPassed).toBe(true);
    expect(native.nativeSurfaceValidationPassed).toBe(true);
  });

  it('applies the same valency gate to every rewrite style', () => {
    const invalid = 'Atualmente exerço como Designer Gráfica na Empresa, onde elaboro materiais.';
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      const fulfillment = evaluateSummaryV2StyleFulfillment({
        style,
        sourceText: 'Atualmente trabalho como Designer Gráfica na Empresa, onde elaboro materiais.',
        candidateText: invalid,
        locale: 'pt-BR',
      });
      expect(fulfillment.nativeSurfaceValidationPassed, style).toBe(false);
      expect(fulfillment.nativeSurfaceRejectionReasons).toContain(
        'locale_verb_morphology:ptbr_invalid_role_intro_valency',
      );
    }
  });

  it('keeps the manifest validator fail-closed for invalid role intros', async () => {
    const cv = cvForDevice();
    const sourceManifest = buildSummaryV2ManifestForCv({
      cv,
      locale: 'pt-BR',
      gender: 'female',
      referenceDateIso: REF,
    });
    const localized = await localizedDeviceManifest(cv);
    const manifest = localized.manifest
      ? projectLocalizedSummaryV2Manifest({ manifest: sourceManifest, localized: localized.manifest })
      : null;
    const generated = runSummaryV2({
      cv,
      locale: 'pt-BR',
      gender: 'female',
      candidate: '',
      referenceDateIso: REF,
      localizedManifest: localized.manifest,
    });
    const invalid = generated.text
      .replace(/Atualmente\s+trabalho\s+como/iu, 'Atualmente exerço como')
      .replace(/Anteriormente\s+trabalhei\s+como/iu, 'Anteriormente exerci como');
    const validation = validateSummaryV2AgainstManifest(invalid, manifest!, {
      candidateSource: 'final_selected',
    });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toBe('ptbr_invalid_role_intro_valency');
  });
});
