import type { CVData, WorkExperience } from '@/lib/types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyGeneratedExperienceDescription,
} from '@/lib/cv-experience-provenance';
import {
  buildSummaryV2ManifestForCv,
  buildSummaryV2EntrySurfaceTransportPlan,
  captureSummaryV2Snapshot,
  classifySummaryV2EntrySurfaceAuthority,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  runSummaryV2,
  projectLocalizedSummaryV2Manifest,
  type SummaryV2LocalizationTransportInput,
} from '@/lib/cv-summary-v2';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';

const SOURCE_HI = [
  'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।',
].join('\n');
const PRESENTATION_PT = [
  'Criei materiais gráficos para mídias impressas e digitais.',
  'Desenvolvi conceitos de design visual de acordo com as necessidades dos clientes.',
  'Revisei projetos de design e verifiquei a qualidade dos resultados finais.',
].join('\n');

function experience(): WorkExperience {
  const base: WorkExperience = {
    id: 'be5c794b',
    position: 'ग्राफिक डिज़ाइनर',
    positionSourceLocale: 'hi',
    company: 'TestWerk GmbH',
    startDate: '2021-01',
    endDate: '2024-01',
    isPresent: false,
    description: SOURCE_HI,
    originalUserDescription: SOURCE_HI,
    canonicalDescription: SOURCE_HI,
    descriptionSourceLocale: 'hi',
    descriptionOrigin: 'user',
  };
  return applyGeneratedExperienceDescription(base, PRESENTATION_PT, {
    locale: 'pt-BR',
    sourceLocale: 'hi',
    origin: 'ai_generated',
    operationMode: 'generate_from_context',
    requestHash: 'aab455-request',
  });
}

function cv(experienceEntries: WorkExperience[]): CVData {
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' },
    experience: experienceEntries,
    education: [],
    skills: [],
    languages: [],
    summary: '',
    contentLocale: 'pt-BR',
  } as unknown as CVData;
}

function targetManifest() {
  return buildSummaryV2ManifestForCv({
    cv: cv([experience()]),
    locale: 'pt-BR',
    gender: 'female',
    referenceDateIso: '2026-07-01',
  });
}

describe('AAB455 Summary mixed fact-authority / presentation-surface contract', () => {
  beforeEach(() => clearSummaryV2LocalizationCacheForTests());

  it('keeps immutable Hindi facts while reusing the trusted target-language AI presentation', async () => {
    const snapshot = captureSummaryV2Snapshot({
      cv: cv([experience()]), locale: 'pt-BR', gender: 'female', referenceDateIso: '2026-07-01',
    });
    const entry = snapshot.entries[0]!;
    expect(entry.facts).toHaveLength(3);
    expect(entry.facts.map((fact) => fact.sourceLocale)).toEqual(['hi', 'hi', 'hi']);
    expect(entry.facts.every((fact) => fact.presentationTrusted === true)).toBe(true);
    expect(entry.facts.map((fact) => fact.presentationLocale)).toEqual(['pt-BR', 'pt-BR', 'pt-BR']);
    expect(entry.facts.map((fact) => fact.bulletText)).toEqual(SOURCE_HI.split('\n'));
    expect(entry.facts.map((fact) => fact.presentationText)).toEqual(PRESENTATION_PT.split('\n'));
    expect(entry.facts.map((fact) => fact.sourceFactHash)).toEqual(
      entry.facts.map((fact) => hashSummaryV2Text(`v2:${entry.entryId}:${fact.bulletText}`)),
    );

    const manifest = targetManifest();
    const authority = classifySummaryV2EntrySurfaceAuthority({
      manifest,
      entry: manifest.current!,
    });
    expect(authority.roleTitleAuthority).toBe('foreign_localization_required');
    expect(authority.localizationRequiredFactIds).toEqual([]);
    expect(authority.targetNativeFactIds).toHaveLength(3);
    expect(buildSummaryV2EntrySurfaceTransportPlan({
      manifest,
      entry: manifest.current!,
    })).toMatchObject({ roleSurfaceCount: 1, factSurfaceCount: 0, bypassedSurfaceCount: 3 });

    const calls: SummaryV2LocalizationTransportInput[] = [];
    const outcome = await localizeSummaryV2Manifest({
      manifest,
      transport: async (input) => {
        calls.push(input);
        return {
          targetLocale: input.targetLocale,
          entries: input.entries.map((requested) => ({
            entryId: requested.entryId,
            localizedRoleTitle: 'Designer gráfica',
            facts: [],
          })),
        };
      },
    });
    expect(outcome.manifest).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.entries[0]!.translateRoleTitle).toBe(true);
    expect(calls[0]!.entries[0]!.facts).toHaveLength(0);
    const localized = outcome.manifest!.entries[0]!;
    expect(localized.facts.map((fact) => fact.localizedText)).toEqual(PRESENTATION_PT.split('\n'));
    expect(localized.facts.map((fact) => fact.sourceTextHash)).toEqual(
      manifest.current!.facts.map((fact) => fact.sourceFactHash),
    );
    expect(outcome.validation?.ok).toBe(true);
    const projected = projectLocalizedSummaryV2Manifest({ manifest, localized: outcome.manifest! });
    expect(projected?.current?.facts.map((fact) => fact.bulletText)).toEqual(PRESENTATION_PT.split('\n'));
    expect(projected?.current?.facts.map((fact) => fact.sourceLocale)).toEqual(['hi', 'hi', 'hi']);
  });

  it('routes only genuinely foreign surfaces in a mixed entry and preserves IDs', async () => {
    const manifest = targetManifest();
    const current = manifest.current!;
    const mixed = {
      ...current,
      role: 'Graphic Designer',
      presentationRole: undefined,
      presentationRoleTrusted: false,
      facts: current.facts.map((fact, index) => index === 0
        ? fact
        : { ...fact, presentationText: undefined, presentationLocale: undefined, presentationTrusted: false }),
    };
    const scoped = { ...manifest, current: mixed, requiredCurrentFacts: mixed.facts };
    const calls: SummaryV2LocalizationTransportInput[] = [];
    const outcome = await localizeSummaryV2Manifest({
      manifest: scoped,
      transport: async (input) => {
        calls.push(input);
        const requested = input.entries[0]!;
        return {
          targetLocale: 'pt-BR',
          entries: [{
            entryId: requested.entryId,
            localizedRoleTitle: 'Designer gráfica',
            facts: requested.facts.map((fact, factIndex) => ({
              factId: fact.factId,
              localizedText: PRESENTATION_PT.split('\n')[factIndex + 1] || PRESENTATION_PT,
            })),
          }],
        };
      },
    });
    expect(outcome.manifest).not.toBeNull();
    expect(calls[0]!.entries[0]!.facts).toHaveLength(2);
    expect(calls[0]!.entries[0]!.translateRoleTitle).toBe(true);
    expect(outcome.manifest!.entries[0]!.facts).toHaveLength(3);
    expect(outcome.manifest!.entries[0]!.facts.map((fact) => fact.factId))
      .toEqual(mixed.facts.map((fact) => fact.factId));
  });

  it('does not trust stale/hash-mismatched or materially edited AI output', () => {
    const applied = experience();
    const stale = { ...applied, description: `${PRESENTATION_PT}\nextra unsupported duty` };
    const snapshot = captureSummaryV2Snapshot({
      cv: cv([stale]), locale: 'pt-BR', gender: 'female', referenceDateIso: '2026-07-01',
    });
    expect(snapshot.entries[0]!.facts.every((fact) => fact.presentationTrusted !== true)).toBe(true);
    expect(snapshot.entries[0]!.facts[0]!.sourceLocale).toBe('hi');
    expect(snapshot.entries[0]!.facts.some((fact) => fact.bulletText.includes('extra unsupported duty'))).toBe(true);
  });

  it('records privacy-safe failure evidence when localization transport fails before Summary generation', async () => {
    const manifest = targetManifest();
    const outcome = await localizeSummaryV2Manifest({
      manifest,
      transport: async () => {
        throw Object.assign(new Error('validation_rejected'), {
          reason: 'locale_impurity', httpStatus: 200, apiResponseKind: 'validation_rejected',
        });
      },
      recoveryTransport: async () => {
        throw Object.assign(new Error('validation_rejected'), {
          reason: 'locale_impurity', httpStatus: 422, apiResponseKind: 'validation_rejected',
        });
      },
    });
    expect(outcome.manifest).toBeNull();
    expect(outcome.validationFailureEvidence).toMatchObject({
      entryId: manifest.current!.entryId,
      surfaceKind: 'localized_role_title',
      textPreviewHash: expect.any(String),
    });
    expect(JSON.stringify(outcome.validationFailureEvidence)).not.toContain('Designer');
  });

  it('replays the AAB454 three-entry device topology through localization and Summary V2', async () => {
    const current: WorkExperience = {
      id: '90ceb215', position: 'مصممة جرافيك', company: 'Rewitu Current Test',
      startDate: '2026-03', endDate: '', isPresent: true,
      description: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.',
      originalUserDescription: 'تنسق طلبات الأرشيف.\nتراجع السجلات.\nتعد المواد.',
      descriptionOrigin: 'user',
    };
    const prior = experience();
    const older: WorkExperience = {
      id: 'a221433', position: 'مصممة جرافيك', company: 'Rewitu',
      startDate: '2019-01', endDate: '2020-09', isPresent: false,
      description: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.',
      originalUserDescription: 'تطور المفاهيم.\nتحرر الصور.\nتنسق المسودات.',
      descriptionOrigin: 'user',
    };
    const manifest = buildSummaryV2ManifestForCv({
      cv: cv([current, prior, older]), locale: 'pt-BR', gender: 'female', referenceDateIso: '2026-07-01',
    });
    expect(manifest.current?.entryId).toBe('90ceb215');
    expect(manifest.priors.map((entry) => entry.entryId)).toEqual(['be5c794b', 'a221433']);
    const outcome = await localizeSummaryV2Manifest({
      manifest,
      transport: async (input) => ({
        targetLocale: 'pt-BR',
        entries: input.entries.map((requested) => ({
          entryId: requested.entryId,
          localizedRoleTitle: 'Designer gráfica',
          facts: requested.facts.map((fact, index) => ({
            factId: fact.factId,
            localizedText: requested.entryId === 'be5c794b'
              ? (PRESENTATION_PT.split('\n')[index] || 'Coordena atividades de design.')
              : (requested.entryId === '90ceb215'
                ? [
                  'Coordeno solicitações do arquivo comunitário.',
                  'Mantenho registros detalhados do serviço.',
                  'Preparo entregas para a equipe.',
                ][index]
                : [
                  'Coordenei solicitações do arquivo comunitário.',
                  'Mantive registros detalhados do serviço.',
                  'Preparei entregas para a equipe.',
                ][index]) || 'Coordena atividades de design.',
          })),
        })),
      }),
    });
    expect(outcome.manifest).not.toBeNull();
    expect(outcome.validation?.ok).toBe(true);
    expect(outcome.manifest!.targetLocale).toBe('pt-BR');
    expect(outcome.manifest!.entries.find((entry) => entry.entryId === 'be5c794b')!.facts
      .map((fact) => fact.localizedText)).toEqual(PRESENTATION_PT.split('\n'));
    const final = runSummaryV2({
      cv: cv([current, prior, older]), locale: 'pt-BR', gender: 'female', candidate: '',
      referenceDateIso: '2026-07-01', localizedManifest: outcome.manifest,
    });
    expect(final.blocked).toBe(false);
    expect(final.countedAsSuccess).toBe(true);
    expect(final.validation.requiredCurrentFactCount).toBe(3);
    expect(final.validation.coveredCurrentFactCount).toBe(3);
    expect(final.validation.requiredPriorFactCount).toBe(6);
    expect(final.validation.coveredPriorFactCount).toBe(6);
    expect(final.validation.targetLocalePurityPassed).toBe(true);
    expect(final.validation.unitOwnershipValidationPassed).toBe(true);
    expect(final.validation.factUnitOwnershipValidationPassed).toBe(true);
    expect(final.text).toContain('mídias impressas e digitais');
    expect(final.text).toContain('necessidades dos clientes');
    expect(final.text).toContain('qualidade dos resultados finais');
  });
});
