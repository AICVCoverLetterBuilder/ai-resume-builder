import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  AI_USAGE_SCHEMA_VERSION,
  getProAiUsageCount,
  persistProAiRecord,
} from '@/lib/ai-usage-policy';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  runSummaryV2,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';

const REF = '2026-07-01';
const DEVICE_SUMMARY = 'Tenho cerca de sete anos de experiência. Atualmente trabalho como Designer Gráfica na Rewitu Current Test, onde elaboro conceitos visuais e layouts para materiais digitais, edito gráficos e imagens para diversos projetos e coordeno rascunhos e revisões com os membros da equipe do projeto. Anteriormente trabalhei como Designer Gráfica na TestWerk GmbH, onde criei materiais gráficos para mídias impressas e digitais, desenvolvi conceitos de design visual de acordo com as necessidades dos clientes e revisei projetos de design e verifiquei a qualidade dos resultados finais. Anteriormente trabalhei como Designer Gráfica na Rewitu, onde elaborei conceitos visuais e layouts para materiais digitais, editei ilustrações e imagens para diversos projetos e coordenei rascunhos e revisões com os membros da equipe do projeto.';

function cvForDevice(): CVData {
  const source = 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।';
  const testWerk = applyGeneratedExperienceDescription({
    id: 'be5c794b', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH',
    startDate: '2020-09', endDate: '2024-01', isPresent: false,
    description: source, originalUserDescription: source, canonicalDescription: source,
    descriptionSourceLocale: 'hi', positionSourceLocale: 'hi', descriptionOrigin: 'user',
  } as WorkExperience, 'Criou materiais gráficos para mídias impressas e digitais.\nDesenvolveu conceitos de design visual de acordo com as necessidades dos clientes.\nRevisou projetos de design e verificou a qualidade dos resultados finais.', {
    locale: 'pt-BR', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'generate_from_context', requestHash: 'aab457-device',
  });
  const current: WorkExperience = {
    id: '90ceb215', position: 'مصممة جرافيك', company: 'Rewitu Current Test', startDate: '2026-03', endDate: '', isPresent: true,
    description: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.', originalUserDescription: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.', descriptionOrigin: 'user',
  } as WorkExperience;
  const older: WorkExperience = {
    id: 'a221433', position: 'مصممة جرافيك', company: 'Rewitu', startDate: '2017-03', endDate: '2020-09', isPresent: false,
    description: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.', originalUserDescription: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.', descriptionOrigin: 'user',
  } as WorkExperience;
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' },
    experience: [current, testWerk, older],
    education: [], skills: [], languages: [], summary: '', contentLocale: 'pt-BR',
  } as unknown as CVData;
}

async function localizedDeviceManifest(cv: CVData) {
  const manifest = buildSummaryV2ManifestForCv({ cv, locale: 'pt-BR', gender: 'female', referenceDateIso: REF });
  return localizeSummaryV2Manifest({
    manifest,
    transport: async (input) => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: 'Designer Gráfica',
        facts: entry.facts.map((fact, index) => ({
          factId: fact.factId,
          localizedText: entry.entryId === 'be5c794b'
            ? ['Criou materiais gráficos para mídias impressas e digitais.', 'Desenvolveu conceitos de design visual de acordo com as necessidades dos clientes.', 'Revisou projetos de design e verificou a qualidade dos resultados finais.'][index]!
            : entry.entryId === '90ceb215'
              ? ['Elabora conceitos visuais e layouts para materiais digitais.', 'Edita gráficos e imagens para diversos projetos.', 'Coordena rascunhos e revisões com os membros da equipe do projeto.'][index]!
              : ['Elaborou conceitos visuais e layouts para materiais digitais.', 'Editou ilustrações e imagens para diversos projetos.', 'Coordenou rascunhos e revisões com os membros da equipe do projeto.'][index]!,
        })),
      })),
    }),
  });
}

describe('AAB457 Summary Stronger quality/manner grounding', () => {
  it('replays PT-BR AAB456 and removes an unsupported Stronger manner claim', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const cv = cvForDevice();
    const localized = await localizedDeviceManifest(cv);
    const generated = runSummaryV2({ cv, locale: 'pt-BR', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized.manifest });
    expect(generated.countedAsSuccess).toBe(true);
    expect(generated.text).toBe(DEVICE_SUMMARY);

    const stronger = runSummaryV2({
      cv: { ...cv, summary: generated.text } as CVData,
      locale: 'pt-BR', gender: 'female', candidate: '', referenceDateIso: REF,
      localizedManifest: localized.manifest, rewriteStyle: 'stronger',
    });
    expect(stronger.blocked, stronger.reason).toBe(false);
    expect(stronger.countedAsSuccess).toBe(true);
    expect(stronger.text).toContain('bem como');
    expect(stronger.text).not.toMatch(/\bcom\s+rigor\b/iu);
    expect(stronger.validation.requiredCurrentFactCount).toBe(3);
    expect(stronger.validation.coveredCurrentFactCount).toBe(3);
    expect(stronger.validation.requiredPriorFactCount).toBe(6);
    expect(stronger.validation.coveredPriorFactCount).toBe(6);
    expect(stronger.validation.qualityMannerAuthorityPassed).toBe(true);
    expect(stronger.validation.unsupportedQualityMannerClaimCount).toBe(0);

    const unsafe = runSummaryV2({
      cv: { ...cv, summary: generated.text } as CVData,
      locale: 'pt-BR', gender: 'female', candidate: stronger.text.replace(/bem como/iu, 'com rigor'),
      referenceDateIso: REF, localizedManifest: localized.manifest, rewriteStyle: 'stronger',
    });
    // The shared pipeline may accept a removal-only repair, but the
    // unsupported phrase must never survive into the selected final text.
    expect(unsafe.blocked).toBe(false);
    expect(unsafe.countedAsSuccess).toBe(true);
    expect(unsafe.text).not.toMatch(/\bcom\s+rigor\b/iu);
    expect(unsafe.validation.qualityMannerAuthorityPassed).toBe(true);

    persistProAiRecord({ schemaVersion: AI_USAGE_SCHEMA_VERSION, count: 5, updatedAt: REF });
    const beforeUsage = getProAiUsageCount();
    const modifierOnly = generated.text.replace(
      /elaboro conceitos/iu,
      'elaboro com rigor conceitos',
    );
    const terminal = finalizeCvAiFieldForApply({
      field: 'summary',
      action: 'summary_stronger',
      requestedLocale: 'pt-BR',
      gender: 'female',
      cv: { ...cv, summary: generated.text } as CVData,
      candidate: modifierOnly,
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      localizedSummaryManifest: localized.manifest,
      rewriteStyle: 'stronger',
    });
    expect(terminal.blocked).toBe(true);
    expect(terminal.countedAsSuccess).toBe(false);
    expect(applyFinalizedSummaryToCv(
      { ...cv, summary: generated.text } as CVData,
      'pt-BR',
      terminal,
    ).summary).toBe(generated.text);
    expect(getProAiUsageCount()).toBe(beforeUsage);
  });

  it('rejects unsupported PT-BR evaluative manner/quality additions fail-closed', async () => {
    const cv = cvForDevice();
    const localized = await localizedDeviceManifest(cv);
    const generated = runSummaryV2({ cv, locale: 'pt-BR', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized.manifest });
    const stronger = runSummaryV2({ cv: { ...cv, summary: generated.text } as CVData, locale: 'pt-BR', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized.manifest, rewriteStyle: 'stronger' });
    const forbidden = [
      'com rigor', 'com precisão', 'com excelência', 'com eficiência', 'cuidadosamente',
      'meticulosamente', 'de forma estratégica', 'de forma consistente', 'com elevado padrão de qualidade',
      'rigorosos', 'precisos', 'excelentes', 'eficientes', 'estratégicos', 'consistentes',
    ];
    for (const phrase of forbidden) {
      const candidate = stronger.text.replace(/bem como/iu, phrase);
      const validation = validateSummaryV2AgainstManifest(candidate, stronger.manifest, { candidateSource: 'final_selected' });
      expect(validation.ok, phrase).toBe(false);
      expect(validation.reason, phrase).toBe('unsupported_quality_manner_claim');
      expect(validation.qualityMannerAuthorityPassed, phrase).toBe(false);
      expect(validation.unsupportedQualityMannerClaimCount, phrase).toBeGreaterThan(0);
    }
  });

  it('accepts a quality/manner phrase only when the same owned fact authorizes it', async () => {
    const cv = cvForDevice();
    const localized = await localizedDeviceManifest(cv);
    const generated = runSummaryV2({ cv, locale: 'pt-BR', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized.manifest });
    const stronger = runSummaryV2({ cv: { ...cv, summary: generated.text } as CVData, locale: 'pt-BR', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized.manifest, rewriteStyle: 'stronger' });
    const owned = structuredClone(stronger.manifest);
    const current = owned.current!;
    current.facts[0] = { ...current.facts[0], bulletText: 'Elaboro com rigor conceitos visuais e layouts para materiais digitais.' };
    owned.requiredCurrentFacts = owned.requiredCurrentFacts.map((fact) => fact.factId === current.facts[0]!.factId ? current.facts[0]! : fact);
    const candidate = stronger.text.replace(/elaboro conceitos/iu, 'elaboro com rigor conceitos');
    const validation = validateSummaryV2AgainstManifest(candidate, owned, { candidateSource: 'provider' });
    expect(validation.qualityMannerAuthorityPassed).toBe(true);
    expect(validation.unsupportedQualityMannerClaimCount).toBe(0);
  });
});
