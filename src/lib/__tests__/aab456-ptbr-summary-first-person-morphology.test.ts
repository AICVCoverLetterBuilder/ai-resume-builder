import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  runSummaryV2,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import {
  analyzePortugueseBrazilFirstPersonFiniteVerbs,
  analyzePortugueseBrazilSummaryEmploymentQuality,
} from '@/lib/cv-portuguese-summary-grounding';
import { evaluateSummaryV2NativeSurface } from '@/lib/cv-summary-v2/native-surface';

const DEVICE_SUMMARY = 'Tenho cerca de sete anos de experiência. Atualmente trabalho como Designer Gráfica na Rewitu Current Test, onde elaboro conceitos visuais e layouts para materiais digitais, edito gráficos e imagens para diversos projetos e coordeno rascunhos e revisões com os membros da equipe do projeto. Anteriormente trabalhei como Designer Gráfica na TestWerk GmbH, onde criei materiais gráficos para mídias impressas e digitais, desenvolvi conceitos de design visual de acordo com as necessidades dos clientes e revisei projetos de design e verifiquei a qualidade dos resultados finais. Anteriormente trabalhei como Designer Gráfica na Rewitu, onde elaborei conceitos visuais e layouts para materiais digitais, editei ilustrações e imagens para diversos projetos e coordenei rascunhos e revisões com os membros da equipe do projeto.';

const MALFORMED = 'Tenho cerca de sete anos de experiência. Atualmente trabalho como Designer Gráfica na Rewitu Current Test, onde elaboro conceitos visuais e layouts para materiais digitais, edito gráficos e imagens para diversos projetos e coordeno rascunhos e revisões com os membros da equipe do projeto. Anteriormente trabalhei como Designer Gráfica na TestWerk GmbH, onde criei materiais gráficos para mídias impressas e digitais, desenvolveu conceitos de design visual de acordo com as necessidades dos clientes e revisei projetos de design e verificou a qualidade dos resultados finais.';

describe('AAB456 PT-BR Summary first-person finite morphology', () => {
  const cvForDeviceReplay = (entries: WorkExperience[]): CVData => ({
    personal: { firstName: 'A', lastName: 'B', gender: 'female' },
    experience: entries,
    education: [], skills: [], languages: [], summary: '', contentLocale: 'pt-BR',
  } as unknown as CVData);

  it('replays the AAB455 PT-BR three-entry device path and realizes every TestWerk verb', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const source = 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।';
    const testWerk = applyGeneratedExperienceDescription({
      id: 'be5c794b', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH',
      // The non-overlapping 40 + 42 + 4 months equal the documented AAB455
      // 86-month device topology.
      startDate: '2020-09', endDate: '2024-01', isPresent: false,
      description: source, originalUserDescription: source, canonicalDescription: source,
      descriptionSourceLocale: 'hi', positionSourceLocale: 'hi', descriptionOrigin: 'user',
    } as WorkExperience, 'Criou materiais gráficos para mídias impressas e digitais.\nDesenvolveu conceitos de design visual de acordo com as necessidades dos clientes.\nRevisou projetos de design e verificou a qualidade dos resultados finais.', {
      locale: 'pt-BR', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'generate_from_context', requestHash: 'aab456-device',
    });
    const current: WorkExperience = {
      id: '90ceb215', position: 'مصممة جرافيك', company: 'Rewitu Current Test', startDate: '2026-03', endDate: '', isPresent: true,
      description: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.', originalUserDescription: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.', descriptionOrigin: 'user',
    } as WorkExperience;
    const older: WorkExperience = {
      id: 'a221433', position: 'مصممة جرافيك', company: 'Rewitu', startDate: '2017-03', endDate: '2020-09', isPresent: false,
      description: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.', originalUserDescription: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.', descriptionOrigin: 'user',
    } as WorkExperience;
    const cv = cvForDeviceReplay([current, testWerk, older]);
    const manifest = buildSummaryV2ManifestForCv({ cv, locale: 'pt-BR', gender: 'female', referenceDateIso: '2026-07-01' });
    const localized = await localizeSummaryV2Manifest({
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
    const final = runSummaryV2({
      cv, locale: 'pt-BR', gender: 'female', candidate: '', referenceDateIso: '2026-07-01', localizedManifest: localized.manifest,
    });
    expect(final.blocked, final.reason).toBe(false);
    expect(final.countedAsSuccess).toBe(true);
    expect(final.text).toBe(DEVICE_SUMMARY);
    expect(final.text).toContain('desenvolvi conceitos de design visual');
    expect(final.text).toContain('revisei projetos de design e verifiquei');
    expect(final.text).not.toContain('desenvolveu conceitos');
    expect(final.text).not.toContain('verificou a qualidade');
    expect(evaluateSummaryV2NativeSurface({ text: final.text, locale: 'pt-BR' }).nativeSurfaceValidationPassed).toBe(true);

    // The immutable Hindi print fact authorizes a provider claim only when the
    // provider candidate can be assigned to the same TestWerk-owned final unit.
    // This stays inside the device-equivalent test identity so the canonical
    // inventory remains the approved +10 AAB456 delta.
    const providerAccepted = runSummaryV2({
      cv, locale: 'pt-BR', gender: 'female', candidate: final.text,
      referenceDateIso: '2026-07-01', localizedManifest: localized.manifest,
    });
    expect(providerAccepted.origin).toBe('ai_generated');
    expect(providerAccepted.validation.materialAuthority.finalClaimAuthorityEvidence.find(
      (claim) => claim.finalUnitRoleSlot === 'prior_role'
        && claim.authorityMatchPassed,
    )).toMatchObject({
      canonicalCategory: 'design_medium_print',
      authorityMatchPassed: true,
      unsupportedReason: null,
    });

    const unownedProvider = validateSummaryV2AgainstManifest(
      'Tenho experiência e preparei materiais gráficos para mídias impressas e digitais.',
      final.manifest, { candidateSource: 'provider' },
    );
    expect(unownedProvider.materialAuthority.finalClaimAuthorityEvidence[0]).toMatchObject({
      authorityMatchPassed: false,
      finalUnitOwningEntryHash: null,
      unsupportedReason: 'final_unit_owner_missing',
    });

    const crossOwnedProvider = validateSummaryV2AgainstManifest(
      final.text.replace('materiais digitais', 'mídias impressas e digitais'),
      final.manifest, { candidateSource: 'provider' },
    );
    expect(crossOwnedProvider.materialAuthority.finalClaimAuthorityEvidence.find(
      (claim) => claim.finalUnitRoleSlot === 'current_role',
    )).toMatchObject({
      authorityMatchPassed: false,
      authorizingSourceEntryHash: null,
      unsupportedReason: 'owner_matching_source_authority_missing',
    });

    const noTestWerkPrint = structuredClone(final.manifest);
    const testWerkWithoutPrint = noTestWerkPrint.priors.find((entry) => entry.entryId === 'be5c794b')!;
    testWerkWithoutPrint.facts = testWerkWithoutPrint.facts.map((fact) => ({
      ...fact,
      sourcePrintFactPresent: false,
      sourceMaterialClaimCategories: [],
    }));
    noTestWerkPrint.requiredPriorFacts = noTestWerkPrint.requiredPriorFacts.map((fact) => (
      fact.entryId === 'be5c794b'
        ? { ...fact, sourcePrintFactPresent: false, sourceMaterialClaimCategories: [] }
        : fact
    ));
    const noAuthorityProvider = validateSummaryV2AgainstManifest(
      final.text, noTestWerkPrint, { candidateSource: 'provider' },
    );
    expect(noAuthorityProvider.materialAuthority.finalClaimAuthorityEvidence.find(
      (claim) => claim.finalUnitRoleSlot === 'prior_role',
    )).toMatchObject({
      authorityMatchPassed: false,
      authorizingSourceFactHashes: [],
      unsupportedReason: 'owner_matching_source_authority_missing',
    });
  });

  it('accepts every coordinated current/past first-person predicate in the device surface', () => {
    const scan = analyzePortugueseBrazilFirstPersonFiniteVerbs(DEVICE_SUMMARY);
    expect(scan.finiteVerbCount).toBeGreaterThanOrEqual(12);
    expect(scan.wrongPersonFiniteVerbCount).toBe(0);
    expect(scan.firstPersonCompatibleFiniteVerbCount).toBe(scan.finiteVerbCount);
    expect(scan.unitPersonAgreementPassed).toBe(true);

    const native = evaluateSummaryV2NativeSurface({ text: DEVICE_SUMMARY, locale: 'pt-BR' });
    expect(native.nativeSurfaceValidationPassed).toBe(true);
    expect(native.ptbrFiniteVerbCount).toBe(scan.finiteVerbCount);
    expect(native.ptbrWrongPersonFiniteVerbCount).toBe(0);
    expect(native.ptbrUnitPersonAgreementPassed).toBe(true);
  });

  it('rejects mixed first/third-person predicates even when the first verb is correct', () => {
    const scan = analyzePortugueseBrazilFirstPersonFiniteVerbs(MALFORMED);
    expect(scan.wrongPersonFiniteVerbCount).toBe(2);
    expect(scan.wrongPersonFiniteVerbHashes).toHaveLength(2);
    expect(scan.rejectionReasons).toEqual(expect.arrayContaining([
      'ptbr_first_person_morphology_mismatch',
      'ptbr_coordinated_predicate_person_mismatch',
    ]));

    const native = evaluateSummaryV2NativeSurface({ text: MALFORMED, locale: 'pt-BR' });
    expect(native.nativeSurfaceValidationPassed).toBe(false);
    expect(native.grammaticalPersonValidationPassed).toBe(false);
    expect(native.localeVerbMorphologyPassed).toBe(false);
    expect(native.firstPersonPredicateChainPassed).toBe(false);
    expect(native.nativeSurfaceRejectionReasons).toEqual(expect.arrayContaining([
      'ptbr_first_person_morphology_mismatch',
      'ptbr_coordinated_predicate_person_mismatch',
    ]));

    const quality = analyzePortugueseBrazilSummaryEmploymentQuality(MALFORMED, {
      company: 'Rewitu Current Test',
      role: 'Designer Gráfica',
      priorCompany: 'TestWerk GmbH',
      priorRole: 'Designer Gráfica',
      currentEntryDuties: 'elaboro conceptos visuais',
      priorEntryDuties: 'criei materiais gráficos para mídias impressas e digitais',
      expectedDuration: null,
    });
    expect(quality.grammarValidationPassed).toBe(false);
    expect(quality.perspectiveValidationPassed).toBe(false);
    expect(quality.ptbrWrongPersonFiniteVerbCount).toBe(2);
  });

  it.each([
    ['regular -ar present', 'Atualmente trabalho como profissional, onde elaboro relatórios e coordeno projetos.'],
    ['regular -er present', 'Atualmente trabalho como profissional, onde desenvolvo relatórios e recebo solicitações.'],
    ['regular -ir present', 'Atualmente trabalho como profissional, onde edito imagens e divido tarefas.'],
    ['regular -ar past', 'Anteriormente trabalhei como profissional, onde elaborei relatórios e coordenei projetos.'],
    ['regular -er past', 'Anteriormente trabalhei como profissional, onde desenvolvi relatórios e recebi solicitações.'],
    ['regular -ir past', 'Anteriormente trabalhei como profissional, onde editei imagens e dividi tarefas.'],
    ['irregular', 'Anteriormente trabalhei como profissional, onde fiz análises, vi resultados e tive responsabilidades.'],
  ])('accepts %s paradigms', (_label, text) => {
    expect(analyzePortugueseBrazilFirstPersonFiniteVerbs(text).unitPersonAgreementPassed).toBe(true);
  });
});
