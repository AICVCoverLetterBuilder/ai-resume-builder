/** @vitest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { recoverSemanticDutiesFromUserOrigin } from '@/lib/cv-semantic-duty-facts';
import {
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  EXPERIENCE_LOCALIZED_SURFACE_SCHEMA,
  buildExperienceLocalizationSnapshot,
  hashExperienceLocalizedSurfaceValue,
  parseExperienceLocalizationProviderJson,
  parseExperienceLocalizationVerifierJson,
  prepareExperienceLocalizedSurfaces,
  projectExperienceFromLocalizedSurfaces,
  type ExperienceLocalizationIndependentVerificationRecord,
  type ExperienceLocalizationProviderRecord,
  type ExperienceLocalizationProviderResponse,
  type ExperienceLocalizationRequest,
} from '@/lib/cv-experience-localized-surfaces';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';

const LOCALES: Locale[] = ['en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja'];

// Independently authored semantic expectations: warehouse inspection/recording/
// dispatch followed by visual creation/adaptation/final-format preparation.
const SURFACES: Record<Locale, string[]> = {
  en: [
    'Inspect incoming goods for damage.',
    'Record inventory movements.',
    'Prepare goods for dispatch.',
    'Create visual materials.',
    'Adapt design files to project needs.',
    'Prepare final formats for digital screens.',
  ],
  de: [
    'Prüft eingehende Waren auf Schäden.',
    'Erfasst Lagerbewegungen.',
    'Bereitet Waren für den Versand vor.',
    'Erstellt visuelle Materialien.',
    'Passt Designdateien an Projektanforderungen an.',
    'Bereitet finale Formate für digitale Bildschirme vor.',
  ],
  es: [
    'Inspecciona las mercancías recibidas para detectar daños.',
    'Registra los movimientos de inventario.',
    'Prepara las mercancías para el envío.',
    'Crea materiales visuales.',
    'Adapta archivos de diseño a las necesidades del proyecto.',
    'Prepara formatos finales para pantallas digitales.',
  ],
  fr: [
    'Inspecte les marchandises reçues pour détecter les dommages.',
    'Enregistre les mouvements de stock.',
    'Prépare les marchandises pour l’expédition.',
    'Crée des supports visuels.',
    'Adapte les fichiers de design aux besoins du projet.',
    'Prépare les formats finaux pour les écrans numériques.',
  ],
  it: [
    'Ispeziona le merci ricevute per rilevare danni.',
    'Registra i movimenti di inventario.',
    'Prepara le merci per la spedizione.',
    'Crea materiali visivi.',
    'Adatta i file di design alle esigenze del progetto.',
    'Prepara i formati finali per gli schermi digitali.',
  ],
  ar: [
    'يفحص البضائع الواردة لاكتشاف التلف.',
    'يسجل حركات المخزون.',
    'يجهز البضائع للشحن.',
    'ينشئ مواد بصرية.',
    'يكيّف ملفات التصميم مع احتياجات المشروع.',
    'يجهز الصيغ النهائية للشاشات الرقمية.',
  ],
  sr: [
    'Pregleda pristiglu robu radi otkrivanja oštećenja.',
    'Evidentira kretanje zaliha.',
    'Priprema robu za otpremu.',
    'Kreira vizuelne materijale.',
    'Prilagođava dizajnerske datoteke potrebama projekta.',
    'Priprema završne formate za digitalne ekrane.',
  ],
  hr: [
    'Provjerava zaprimljenu robu radi otkrivanja oštećenja.',
    'Evidentira kretanje zaliha u skladištu.',
    'Priprema robu za otpremu iz skladišta.',
    'Izrađuje vizualne materijale za tvrtku.',
    'Prilagođava dizajnerske datoteke potrebama projekta.',
    'Priprema završne formate za digitalne zaslone prema potrebama tvrtke.',
  ],
  ru: [
    'Проверяет поступившие товары на наличие повреждений.',
    'Учитывает перемещения запасов.',
    'Подготавливает товары к отправке.',
    'Создаёт визуальные материалы.',
    'Адаптирует дизайн-файлы к требованиям проекта.',
    'Подготавливает итоговые форматы для цифровых экранов.',
  ],
  'pt-BR': [
    'Inspeciona as mercadorias recebidas para detectar danos.',
    'Registra as movimentações de estoque.',
    'Prepara as mercadorias para envio.',
    'Cria materiais visuais.',
    'Adapta arquivos de design às necessidades do projeto.',
    'Prepara formatos finais para telas digitais.',
  ],
  hi: [
    'क्षति का पता लगाने के लिए आने वाले माल की जाँच करता है।',
    'भंडार की आवाजाही दर्ज करता है।',
    'माल को भेजने के लिए तैयार करता है।',
    'दृश्य सामग्री बनाता है।',
    'डिज़ाइन फ़ाइलों को परियोजना की आवश्यकताओं के अनुसार ढालता है।',
    'डिजिटल स्क्रीन के लिए अंतिम प्रारूप तैयार करता है।',
  ],
  ja: [
    '入荷した商品に損傷がないか確認します。',
    '在庫の移動を記録します。',
    '商品を発送用に準備します。',
    '視覚素材を作成します。',
    'デザインファイルをプロジェクト要件に合わせます。',
    'デジタル画面用の最終形式を準備します。',
  ],
};

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function exp(id: string, position: string, sourceLocale: Locale, duties: string[]): WorkExperience {
  const description = bullets(duties);
  return {
    id,
    position,
    company: id === 'warehouse-entry' ? 'Cargo Company' : 'Studio Company',
    startDate: '2022-01',
    endDate: '',
    isPresent: true,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: sourceLocale,
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(description),
  };
}

function cvFor(sourceLocale: Locale): CVData {
  return {
    id: `matrix-cv-${sourceLocale}`,
    name: 'Matrix CV',
    templateId: 'modern-minimal',
    region: 'EU',
    personal: {
      fullName: 'Matrix Person', email: 'matrix@example.test', phone: '', address: '',
      jobTitle: 'Warehouse Operator', photoEnabled: false,
    },
    summary: 'Professional profile.',
    experience: [
      exp('warehouse-entry', 'Warehouse Operator', sourceLocale, SURFACES[sourceLocale].slice(0, 3)),
      exp('design-entry', 'Graphic Designer', sourceLocale, SURFACES[sourceLocale].slice(3, 6)),
    ],
    education: [], skills: [], certifications: [], languages: [],
    createdAt: '2026-01-01', updatedAt: '2026-08-04', runtimeMigrationVersion: 3,
  };
}

function semanticValidation(passed = true) {
  return {
    validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
    predicatePreserved: passed,
    objectPreserved: passed,
    workDomainPreserved: passed,
    scopePreserved: passed,
    negationPreserved: passed,
    tensePreserved: passed,
    unsupportedFactsIntroduced: !passed,
  } as const;
}

function validResponse(request: ExperienceLocalizationRequest) {
  const records = request.records.map((record): ExperienceLocalizationProviderRecord => ({
    ...record,
    localizedText: SURFACES[request.targetLocale][
      (record.experienceId === 'warehouse-entry' ? 0 : 3) + record.sourceClauseIndex
    ],
    semanticValidation: semanticValidation(),
  }));
  const verificationRecords = records.map((record): ExperienceLocalizationIndependentVerificationRecord => ({
    ...record,
    candidateSurfaceHash: hashExperienceLocalizedSurfaceValue(record.localizedText),
    decision: 'passed',
    mismatchCategory: 'none',
    predicatePreserved: true,
    objectPreserved: true,
    workDomainPreserved: true,
    sourceResponsibilityPreserved: true,
    scopePreserved: true,
    negationPreserved: true,
    tensePreserved: true,
    unsupportedFactsIntroduced: false,
    crossEntryFactIntroduced: false,
    crossOccupationSubstitution: false,
  }));
  return {
    snapshotId: request.snapshotId,
    targetLocale: request.targetLocale,
    records,
    provenance: 'provider' as const,
    independentVerification: {
      snapshotId: request.snapshotId,
      targetLocale: request.targetLocale,
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      records: verificationRecords,
      verifierAttemptCount: 1,
    },
  };
}

function mockDownload(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://aab399-matrix/${blobs.length}`;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(), configurable: true, writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return blobs;
}

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const fileName = String(input).split('/').pop() || '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) return new Response(fs.readFileSync(fontPath), { status: 200 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
});

describe('AAB-399 persisted Experience localized-surface matrix', () => {
  it('passes all 144 ordered pairs with lazy acquisition and exact cache reuse', async () => {
    let total = 0;
    let cross = 0;
    let same = 0;
    for (const sourceLocale of LOCALES) {
      for (const targetLocale of LOCALES) {
        let current = cvFor(sourceLocale);
        let providerCalls = 0;
        let persistenceCalls = 0;
        const adapter = async (request: ExperienceLocalizationRequest) => {
          providerCalls += 1;
          return validResponse(request);
        };
        const first = await prepareExperienceLocalizedSurfaces({
          cv: current,
          targetLocale,
          adapter,
          getCurrentCv: () => current,
          persist: (next) => {
            persistenceCalls += 1;
            current = next;
            return true;
          },
        });
        expect(first.ok, `${sourceLocale}->${targetLocale}: ${JSON.stringify(first)}`).toBe(true);
        if (!first.ok) continue;
        const isCross = sourceLocale !== targetLocale;
        expect(providerCalls).toBe(isCross ? 1 : 0);
        expect(persistenceCalls).toBe(isCross ? 1 : 0);
        expect(first.diagnostics.persistedSurfaceCount).toBe(isCross ? 6 : 0);
        expect(new Set(first.snapshot.records.map((record) => record.requestIdentity)).size).toBe(6);
        expect(first.snapshot.records.every((record) => (
          record.sourceLocale === sourceLocale
          && record.targetLocale === targetLocale
          && record.cvId === `matrix-cv-${sourceLocale}`
        ))).toBe(true);

        for (let index = 0; index < current.experience.length; index += 1) {
          const entry = current.experience[index];
          const grounding = recoverSemanticDutiesFromUserOrigin(entry, current.canonicalSnapshot);
          const projected = projectExperienceFromLocalizedSurfaces({
            cv: current, exp: entry, grounding, targetLocale,
          });
          expect(splitExperienceBullets(projected || '')).toEqual(
            SURFACES[targetLocale].slice(index * 3, index * 3 + 3),
          );
        }

        const repeated = await prepareExperienceLocalizedSurfaces({
          cv: current,
          targetLocale,
          adapter,
          getCurrentCv: () => current,
          persist: () => {
            persistenceCalls += 1;
            return false;
          },
        });
        expect(repeated.ok).toBe(true);
        expect(providerCalls).toBe(isCross ? 1 : 0);
        expect(persistenceCalls).toBe(isCross ? 1 : 0);
        expect(repeated.diagnostics.cacheReuseCount).toBe(isCross ? 6 : 0);
        total += 1;
        if (isCross) cross += 1;
        else same += 1;
      }
    }
    expect({ total, cross, same }).toEqual({ total: 144, cross: 132, same: 12 });
  }, 60_000);

  it('rejects identity, semantic, response-shape, race, and transaction failures atomically', async () => {
    type Mutation = (response: ReturnType<typeof validResponse>, request: ExperienceLocalizationRequest) => void;
    const mutations: Array<[string, Mutation]> = [
      ['other-entry', (response) => { response.records[0].experienceId = 'design-entry'; }],
      ['other-source-hash', (response) => { response.records[0].sourceClauseHash = 'wrong'; }],
      ['other-fact', (response) => { response.records[0].semanticFactId = 'wrong'; }],
      ['other-source-locale', (response) => { response.records[0].sourceLocale = 'fr'; }],
      ['other-target-locale', (response) => { response.records[0].targetLocale = 'fr'; }],
      ['stale-canonical', (response) => { response.records[0].canonicalLineageHash = 'stale'; }],
      ['duplicate', (response) => { response.records[5] = structuredClone(response.records[0]); }],
      ['missing', (response) => { response.records.pop(); }],
      ['partial', (response) => { response.records.splice(2, 2); }],
      ['additional', (response) => { response.records.push({ ...structuredClone(response.records[0]), requestIdentity: 'unknown' }); }],
      ['wrong-script', (response) => { response.records[0].localizedText = 'يفحص البضائع الواردة لاكتشاف التلف.'; }],
      ['unrelated-semantic-independent-reject', (response) => {
        response.records[0].localizedText = 'Crea materiales visuales para plataformas digitales.';
        const verdict = response.independentVerification.records[0];
        verdict.candidateSurfaceHash = hashExperienceLocalizedSurfaceValue(
          response.records[0].localizedText,
        );
        verdict.decision = 'rejected';
        verdict.mismatchCategory = 'cross_occupation_substitution';
        verdict.workDomainPreserved = false;
        verdict.crossOccupationSubstitution = true;
      }],
      ['verifier-other-entry', (response) => {
        response.independentVerification.records[0].experienceId = 'design-entry';
      }],
      ['verifier-candidate-hash', (response) => {
        response.independentVerification.records[0].candidateSurfaceHash = 'wrong';
      }],
      ['verifier-partial', (response) => { response.independentVerification.records.pop(); }],
      ['verifier-duplicate', (response) => {
        response.independentVerification.records[5] = structuredClone(
          response.independentVerification.records[0],
        );
      }],
    ];
    for (const [name, mutate] of mutations) {
      const raw = cvFor('de');
      const current = raw;
      let persistCalls = 0;
      const before = structuredClone(raw);
      const result = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale: 'es',
        adapter: async (request) => {
          const response = validResponse(request);
          mutate(response, request);
          return response;
        },
        getCurrentCv: () => current,
        persist: () => {
          persistCalls += 1;
          return true;
        },
      });
      expect(result.ok, name).toBe(false);
      expect(persistCalls, name).toBe(0);
      expect(current, name).toEqual(before);
    }

    const raceCases: Array<[string, (cv: CVData) => CVData]> = [
      ['source-edit', (cv) => ({
        ...cv,
        experience: cv.experience.map((entry, index) => index === 0
          ? { ...entry, description: `${entry.description}\n- Neue Pflicht.` }
          : entry),
      })],
      ['entry-delete', (cv) => ({ ...cv, experience: cv.experience.slice(1) })],
      ['entry-reorder', (cv) => ({ ...cv, experience: [...cv.experience].reverse() })],
      ['canonical-change', (cv) => ({
        ...cv,
        canonicalSnapshot: {
          canonicalSummary: '', canonicalExperiences: [], canonicalLocale: 'de',
          canonicalRevision: 2, canonicalSourceHash: 'changed',
          canonicalCreatedFrom: 'legacy_migration', canonicalState: 'valid',
        },
      })],
    ];
    for (const [name, mutate] of raceCases) {
      const raw = cvFor('de');
      let current = raw;
      let persistCalls = 0;
      const result = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale: 'es',
        adapter: async (request) => {
          current = mutate(current);
          return validResponse(request);
        },
        getCurrentCv: () => current,
        persist: () => {
          persistCalls += 1;
          return true;
        },
      });
      expect(result.ok, name).toBe(false);
      if (!result.ok) expect(result.reason, name).toBe('experience_localization_stale_snapshot');
      expect(persistCalls, name).toBe(0);
    }

    {
      const raw = cvFor('de');
      const current = raw;
      const result = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale: 'es',
        adapter: async (request) => validResponse(request),
        getCurrentCv: () => current,
        persist: () => false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('experience_localization_persistence_failed');
      expect(current).toBe(raw);
    }
    {
      const raw = cvFor('de');
      const result = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale: 'es',
        adapter: async () => { throw new Error('timeout'); },
        getCurrentCv: () => raw,
        persist: () => true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('experience_localization_provider_failed');
    }
    {
      const raw = cvFor('de');
      const result = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale: 'es',
        adapter: async () => {
          const failure = new Error('experience_localization_verifier_failed') as Error & {
            translationProviderAttemptCount: number;
            independentVerifierAttemptCount: number;
            translatedRecordCount: number;
          };
          failure.translationProviderAttemptCount = 1;
          failure.independentVerifierAttemptCount = 1;
          failure.translatedRecordCount = 6;
          throw failure;
        },
        getCurrentCv: () => raw,
        persist: () => true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('experience_localization_verifier_failed');
        expect(result.stage).toBe('independent_verification');
        expect(result.diagnostics).toMatchObject({
          providerRequestCount: 1,
          independentVerifierRequestCount: 1,
          returnedRecordCount: 6,
          independentlyRejectedRecordCount: 6,
        });
      }
    }
    {
      const raw = cvFor('de');
      let persistCalls = 0;
      const result = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale: 'es',
        adapter: async (request) => {
          const response = validResponse(request);
          delete (response as Partial<ExperienceLocalizationProviderResponse>).independentVerification;
          return response as unknown as ExperienceLocalizationProviderResponse;
        },
        getCurrentCv: () => raw,
        persist: () => { persistCalls += 1; return true; },
      });
      expect(result.ok).toBe(false);
      expect(persistCalls).toBe(0);
    }
  });

  it('ignores translator self-attestation in both directions and trusts only bound verification', async () => {
    {
      const raw = cvFor('de');
      let persistCalls = 0;
      const rejected = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale: 'es',
        adapter: async (request) => {
          const response = validResponse(request);
          response.records[0].localizedText = 'Desarrolla servicios de software para clientes.';
          response.records[0].semanticValidation = semanticValidation(true);
          const verdict = response.independentVerification.records[0];
          verdict.candidateSurfaceHash = hashExperienceLocalizedSurfaceValue(
            response.records[0].localizedText,
          );
          verdict.decision = 'rejected';
          verdict.mismatchCategory = 'cross_occupation_substitution';
          verdict.predicatePreserved = false;
          verdict.objectPreserved = false;
          verdict.workDomainPreserved = false;
          verdict.sourceResponsibilityPreserved = false;
          verdict.crossOccupationSubstitution = true;
          return response;
        },
        getCurrentCv: () => raw,
        persist: () => { persistCalls += 1; return true; },
      });
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(rejected.reason).toBe('experience_localization_independent_semantic_validation_failed');
        expect(rejected.diagnostics.independentlyRejectedRecordCount).toBe(6);
        expect(rejected.diagnostics.semanticMismatchCategory)
          .toBe('cross_occupation_substitution');
      }
      expect(persistCalls).toBe(0);
      expect(raw.experienceLocalizedSurfaces).toBeUndefined();
    }

    {
      let current = cvFor('de');
      const accepted = await prepareExperienceLocalizedSurfaces({
        cv: current,
        targetLocale: 'es',
        adapter: async (request) => {
          const response = validResponse(request);
          response.records.forEach((record) => {
            record.semanticValidation = semanticValidation(false);
          });
          return response;
        },
        getCurrentCv: () => current,
        persist: (next) => { current = next; return true; },
      });
      expect(accepted.ok).toBe(true);
      expect(accepted.diagnostics.independentlyValidatedRecordCount).toBe(6);
      expect(Object.keys(current.experienceLocalizedSurfaces?.surfaces || {})).toHaveLength(6);
    }
  });

  it('fails ambiguous source locale, ignores malformed/old cached surfaces, and parses JSON strictly', async () => {
    const ambiguous = cvFor('de');
    ambiguous.experience = [
      exp('ambiguous', 'Role', 'de', ['zz-one', 'zz-two', 'zz-three']),
    ];
    ambiguous.experience[0].descriptionSourceLocale = undefined;
    const ambiguousSnapshot = buildExperienceLocalizationSnapshot(ambiguous, 'es');
    expect(ambiguousSnapshot.ok).toBe(false);
    expect(ambiguousSnapshot.reason).toBe('experience_localization_source_locale_ambiguous');

    let current = cvFor('de');
    const seeded = await prepareExperienceLocalizedSurfaces({
      cv: current, targetLocale: 'es',
      adapter: async (request) => validResponse(request),
      getCurrentCv: () => current,
      persist: (next) => { current = next; return true; },
    });
    expect(seeded.ok).toBe(true);
    const firstKey = Object.keys(current.experienceLocalizedSurfaces?.surfaces || {})[0];
    const first = current.experienceLocalizedSurfaces!.surfaces[firstKey];
    current = {
      ...current,
      experienceLocalizedSurfaces: {
        schemaVersion: 1,
        surfaces: {
          ...current.experienceLocalizedSurfaces!.surfaces,
          [firstKey]: {
            ...first,
            validatorVersion: 'experience-localization-validator-399-v1',
          } as typeof first,
        },
      },
    };
    expect(buildExperienceLocalizationSnapshot(current, 'es').missingRecords).toHaveLength(1);

    current = {
      ...current,
      experienceLocalizedSurfaces: {
        schemaVersion: 1,
        surfaces: {
          ...current.experienceLocalizedSurfaces!.surfaces,
          [firstKey]: { ...first, surfaceSchema: 'old-surface' as typeof EXPERIENCE_LOCALIZED_SURFACE_SCHEMA },
        },
      },
    };
    const stale = buildExperienceLocalizationSnapshot(current, 'es');
    expect(stale.missingRecords).toHaveLength(1);

    current = {
      ...current,
      experienceLocalizedSurfaces: {
        schemaVersion: 1,
        surfaces: {
          ...current.experienceLocalizedSurfaces!.surfaces,
          [firstKey]: { ...first, localizedTextHash: 'malformed-hash' },
        },
      },
    };
    expect(buildExperienceLocalizationSnapshot(current, 'es').missingRecords).toHaveLength(1);

    const unsupportedPt = cvFor('pt-BR');
    unsupportedPt.experience[0].descriptionSourceLocale = 'pt';
    const detectedPt = buildExperienceLocalizationSnapshot(unsupportedPt, 'ru');
    expect(detectedPt.ok).toBe(true);
    expect(detectedPt.records.slice(0, 3).every((record) => record.sourceLocale === 'pt-BR')).toBe(true);
    expect(Object.values(detectedPt.diagnostics.sourceLocaleResolutionByEntry))
      .toContain('current_authoritative_text');

    for (const origin of ['ai_generated', 'unknown'] as const) {
      const notManual = cvFor('de');
      notManual.experience = notManual.experience.map((entry) => ({
        ...entry,
        descriptionOrigin: origin as WorkExperience['descriptionOrigin'],
      }));
      let providerCalls = 0;
      let persistenceCalls = 0;
      const ignored = await prepareExperienceLocalizedSurfaces({
        cv: notManual,
        targetLocale: 'es',
        adapter: async (request) => {
          providerCalls += 1;
          return validResponse(request);
        },
        getCurrentCv: () => notManual,
        persist: () => {
          persistenceCalls += 1;
          return true;
        },
      });
      expect(ignored.ok, origin).toBe(true);
      expect(ignored.snapshot.records, origin).toHaveLength(0);
      expect(providerCalls, origin).toBe(0);
      expect(persistenceCalls, origin).toBe(0);
    }

    expect(parseExperienceLocalizationProviderJson('```json\n{}\n```')).toBeNull();
    expect(parseExperienceLocalizationProviderJson('{"targetLocale":"es","records":[]}')).toBeNull();
    expect(parseExperienceLocalizationVerifierJson('verdict: {"records":[]}')).toBeNull();
    expect(parseExperienceLocalizationVerifierJson(JSON.stringify({
      snapshotId: 'snapshot',
      targetLocale: 'es',
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      records: [{ requestIdentity: 'partial' }],
    }))).toBeNull();
  });

  it('invalidates edited/deleted source bindings while retaining independently valid target locales', async () => {
    let current = cvFor('de');
    const seed = async (targetLocale: Locale) => prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale,
      adapter: async (request) => validResponse(request),
      getCurrentCv: () => current,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect((await seed('es')).ok).toBe(true);
    expect((await seed('fr')).ok).toBe(true);
    expect(Object.keys(current.experienceLocalizedSurfaces?.surfaces || {})).toHaveLength(12);
    expect(buildExperienceLocalizationSnapshot(current, 'es').cachedSurfaces).toHaveLength(6);
    expect(buildExperienceLocalizationSnapshot(current, 'fr').cachedSurfaces).toHaveLength(6);

    const edited = structuredClone(current);
    edited.experience[0].description = edited.experience[0].description.replace(
      SURFACES.de[0],
      'Prüft neu eingegangene Waren sorgfältig auf Schäden.',
    );
    const editedSnapshot = buildExperienceLocalizationSnapshot(edited, 'es');
    expect(editedSnapshot.cachedSurfaces).toHaveLength(5);
    expect(editedSnapshot.missingRecords).toHaveLength(1);

    const deleted = { ...current, experience: current.experience.slice(1) };
    const deletedSnapshot = buildExperienceLocalizationSnapshot(deleted, 'es');
    expect(deletedSnapshot.records.every((record) => record.experienceId === 'design-entry')).toBe(true);
    expect(deletedSnapshot.cachedSurfaces).toHaveLength(3);

    const reordered = { ...current, experience: [...current.experience].reverse() };
    const reorderedSnapshot = buildExperienceLocalizationSnapshot(reordered, 'es');
    expect(reorderedSnapshot.cachedSurfaces).toHaveLength(6);
    expect(reorderedSnapshot.records.slice(0, 3).every((record) => (
      record.experienceId === 'design-entry'
    ))).toBe(true);
  });

  it('rejects fluent cross-domain substitutions across representative scripts', async () => {
    const pairs: Array<[Locale, Locale]> = [
      ['en', 'de'], ['en', 'ar'], ['ar', 'en'], ['en', 'hi'], ['hi', 'en'],
      ['en', 'ja'], ['ja', 'en'], ['sr', 'hr'], ['hr', 'sr'], ['ru', 'pt-BR'],
    ];
    let accepted = 0;
    let persisted = 0;
    for (const [sourceLocale, targetLocale] of pairs) {
      const raw = cvFor(sourceLocale);
      const result = await prepareExperienceLocalizedSurfaces({
        cv: raw,
        targetLocale,
        adapter: async (request) => {
          const response = validResponse(request);
          response.records[0].localizedText = SURFACES[targetLocale][3];
          const verdict = response.independentVerification.records[0];
          verdict.candidateSurfaceHash = hashExperienceLocalizedSurfaceValue(
            response.records[0].localizedText,
          );
          verdict.decision = 'rejected';
          verdict.mismatchCategory = 'cross_occupation_substitution';
          verdict.predicatePreserved = false;
          verdict.objectPreserved = false;
          verdict.workDomainPreserved = false;
          verdict.sourceResponsibilityPreserved = false;
          verdict.crossOccupationSubstitution = true;
          return response;
        },
        getCurrentCv: () => raw,
        persist: () => { persisted += 1; return true; },
      });
      if (result.ok) accepted += 1;
    }
    expect(accepted).toBe(0);
    expect(persisted).toBe(0);
  });

  it('renders the ten required cross-script directions through one PDF/DOCX template and reuses cache', async () => {
    const pairs: Array<[Locale, Locale]> = [
      ['en', 'ar'], ['ar', 'en'], ['en', 'hi'], ['hi', 'en'], ['en', 'ja'],
      ['ja', 'en'], ['sr', 'de'], ['de', 'sr'], ['ru', 'pt-BR'], ['pt-BR', 'ru'],
    ];
    const blobs = mockDownload();
    for (const [sourceLocale, targetLocale] of pairs) {
      let current = cvFor(sourceLocale);
      current = {
        ...current,
        summary: SURFACES[targetLocale].join(' '),
        canonicalSummary: SURFACES[targetLocale].join(' '),
        summaryOrigin: 'user',
        contentLocale: targetLocale,
      };
      let providerCalls = 0;
      const localized = await prepareExperienceLocalizedSurfaces({
        cv: current,
        targetLocale,
        adapter: async (request) => {
          providerCalls += 1;
          return validResponse(request);
        },
        getCurrentCv: () => current,
        persist: (next) => { current = next; return true; },
      });
      expect(localized.ok, `${sourceLocale}->${targetLocale}`).toBe(true);
      expect(providerCalls).toBe(1);
      const renderCv: CVData = {
        ...current,
        experience: current.experience.map((entry) => {
          const grounding = recoverSemanticDutiesFromUserOrigin(entry, current.canonicalSnapshot);
          const description = projectExperienceFromLocalizedSurfaces({
            cv: current, exp: entry, grounding, targetLocale,
          });
          expect(description, `${sourceLocale}->${targetLocale}:${entry.id}`).not.toBeNull();
          return { ...entry, description: description || '' };
        }),
      };
      expect(renderCv.experience.map((entry) => splitExperienceBullets(entry.description)))
        .toEqual([SURFACES[targetLocale].slice(0, 3), SURFACES[targetLocale].slice(3, 6)]);
      const pdf = await buildModernMinimalPdfBlob(renderCv, targetLocale);
      expect(pdf.size).toBeGreaterThan(0);
      const beforeDocx = blobs.length;
      const docx = await exportToDOCX(
        renderCv,
        `aab399-${sourceLocale}-${targetLocale}`,
        targetLocale,
        'modern-minimal',
      );
      expect(docx.result).toBe('saved');
      expect(blobs.length).toBe(beforeDocx + 1);
      expect(blobs.at(-1)?.size).toBeGreaterThan(0);

      const cached = await prepareExperienceLocalizedSurfaces({
        cv: current,
        targetLocale,
        adapter: async () => { throw new Error('cache miss'); },
        getCurrentCv: () => current,
        persist: () => false,
      });
      expect(cached.ok).toBe(true);
      expect(cached.diagnostics.cacheReuseCount).toBe(6);
      expect(providerCalls).toBe(1);
    }
  }, 60_000);
});
