/** @vitest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { buildCanonicalSnapshotFromCv } from '@/lib/cv-canonical-snapshot';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import {
  hashUserOriginSourceClause,
  recoverSemanticDutiesFromUserOrigin,
  recoveredUserOriginNeedsSourceBoundLocalization,
  resolveExperienceSemanticGrounding,
} from '@/lib/cv-semantic-duty-facts';
import { resolveCvExportToastMappingKey } from '@/lib/cv-export-diagnostics';
import { formatCvExportIntegrityToast } from '@/lib/cv-export-error-message';
import type { Locale } from '@/lib/i18n/translations';
import {
  buildExperienceLocalizationSnapshot,
  EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE,
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  hashExperienceLocalizedSurfaceValue,
  prepareExperienceLocalizedSurfaces,
  type ExperienceLocalizationIndependentVerificationRecord,
  type ExperienceLocalizationProviderRecord,
  type ExperienceLocalizationRequest,
} from '@/lib/cv-experience-localized-surfaces';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';

const BICYCLE_DE = [
  'Prüft Fahrräder auf technische Mängel und Verschleiß.',
  'Führt Wartungs- und Reparaturarbeiten an Bremsen, Schaltung und Rädern durch.',
  'Berät Kunden zu Reparaturen und geeigneten Ersatzteilen.',
];
const RECEPTION_DE = [
  'Begrüßt Gäste und führt den Check-in und Check-out durch.',
  'Bearbeitet Reservierungen und beantwortet Anfragen.',
  'Koordiniert Gästewünsche mit den zuständigen Hotelabteilungen.',
];
const STALE_DESIGN_DE = [
  'Erledigt die täglichen Designaufgaben und prüft die Genauigkeit zugehöriger Materialien.',
  'Prüft und passt Designmaterialien an die Projektanforderungen an.',
  'Bereitet finale Designdateien vor und stellt Formate für unterschiedliche Bildschirme ein.',
];
const STALE_DESIGN_ES = [
  'Realiza las tareas diarias de diseño y comprueba la exactitud de los materiales relacionados.',
  'Revisa y adapta materiales de diseño según los requisitos del proyecto.',
  'Prepara archivos finales de diseño y ajusta formatos para distintas pantallas.',
];
const BICYCLE_ES = [
  'Inspecciona bicicletas para detectar defectos técnicos y desgaste.',
  'Realiza trabajos de mantenimiento y reparación en frenos, cambios y ruedas.',
  'Asesora a los clientes sobre reparaciones y piezas de repuesto adecuadas.',
];
const RECEPTION_ES = [
  'Recibe a los huéspedes y realiza el registro de entrada y salida.',
  'Gestiona reservas y responde a consultas.',
  'Coordina las solicitudes de los huéspedes con los departamentos responsables del hotel.',
];
const BLOCKER_CURRENT_RECEPTION_EN = [
  'Welcomed guests and completed check-in.',
  'Managed reservations and answered inquiries.',
  'Coordinated guest requests with hotel departments.',
];
const BLOCKER_CURRENT_RECEPTION_ES = [
  'Recibe a los huéspedes y completa el registro de entrada.',
  'Gestiona reservas y responde a consultas.',
  'Coordina las solicitudes de los huéspedes con los departamentos del hotel.',
];
const BLOCKER_STALE_COOKING_EN = [
  'Prepared dishes according to restaurant requirements.',
  'Maintained workplace hygiene.',
  'Collaborated with the kitchen team.',
];
const BLOCKER_STALE_COOKING_ES = [
  'Prepara platos según los requisitos del restaurante.',
  'Mantiene la higiene del lugar de trabajo.',
  'Colabora con el equipo de cocina.',
];

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join('\n');

function entry(id: string, position: string, company: string, visible: string[]): WorkExperience {
  return {
    id, position, company, startDate: '2022-01', endDate: '', isPresent: true,
    description: bullets(visible),
    originalUserDescription: bullets(STALE_DESIGN_DE),
    canonicalDescription: bullets(STALE_DESIGN_DE),
    descriptionOrigin: 'user',
    groundingRecoverySource: 'legacy_user_origin_duties',
  };
}

function passedSemanticValidation() {
  return {
    validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
    predicatePreserved: true,
    objectPreserved: true,
    workDomainPreserved: true,
    scopePreserved: true,
    negationPreserved: true,
    tensePreserved: true,
    unsupportedFactsIntroduced: false,
  } as const;
}

function passedIndependentVerification(
  request: ExperienceLocalizationRequest,
  records: ExperienceLocalizationProviderRecord[],
) {
  return {
    snapshotId: request.snapshotId,
    targetLocale: request.targetLocale,
    validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
    records: records.map((record): ExperienceLocalizationIndependentVerificationRecord => ({
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
    })),
    verifierAttemptCount: 1,
  } as const;
}

function mockDownload(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://aab399/${blobs.length}`;
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

beforeEach(() => localStorage.clear());

function deviceCv(): CVData {
  const visible: CVData = {
    id: 'aab399-device', name: 'Preserved CV', templateId: 'modern-minimal', region: 'EU',
    personal: { fullName: 'Test Person', email: 'test@example.test', phone: '', address: '', jobTitle: 'Service', photoEnabled: false },
    summary: 'Profesional de servicios con experiencia en atención y mantenimiento.',
    canonicalSummary: 'Profesional de servicios con experiencia en atención y mantenimiento.',
    summaryOrigin: 'deterministic_fallback', contentLocale: 'es', runtimeMigrationVersion: 3,
    experience: [
      entry('exp-bicycle', 'Fahrradmechaniker', 'Fahrrad Werkstatt', BICYCLE_DE),
      entry('exp-reception', 'Rezeptionist', 'Hotel Zentrum', RECEPTION_DE),
    ],
    education: [], skills: [], certifications: [], languages: [],
    createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z',
  };
  const staleCanonical = {
    ...visible,
    contentLocale: 'de',
    experience: visible.experience.map((exp) => ({ ...exp, description: bullets(STALE_DESIGN_DE) })),
  };
  const canonicalSnapshot = buildCanonicalSnapshotFromCv(staleCanonical, {
    canonicalLocale: 'de', createdFrom: 'legacy_migration', revision: 1, state: 'valid',
  });
  return {
    ...visible,
    canonicalSnapshot,
    localizedProjections: {
      es: {
        projectionId: 'stale-shared-design-projection',
        requestedLocale: 'es',
        canonicalLocale: 'de',
        canonicalRevision: canonicalSnapshot.canonicalRevision,
        canonicalSourceHash: canonicalSnapshot.canonicalSourceHash,
        localizedSummary: visible.summary,
        localizedSummaryProvenance: {
          requestedLocale: 'es', canonicalLocale: 'de', localizedLocale: 'es',
          canonicalRevision: canonicalSnapshot.canonicalRevision,
          canonicalSourceHash: canonicalSnapshot.canonicalSourceHash,
          origin: 'deterministic_fallback',
        },
        localizedExperiences: canonicalSnapshot.canonicalExperiences.map((exp) => ({
          experienceId: exp.experienceId,
          role: exp.role,
          company: exp.company,
          bullets: exp.bullets.map((bullet, order) => ({
            factId: bullet.factId,
            semanticCategory: bullet.semanticCategory,
            localizedText: STALE_DESIGN_ES[order],
            order,
          })),
        })),
        localizedEducation: [],
        localizedSkills: [],
        localizedLanguageLevels: [],
        validationStatus: 'passed',
      },
    },
  };
}

describe('AAB-399 device-shaped Experience semantic provenance', () => {
  it('never substitutes the shared stale graphic-design lineage for two current German entries', () => {
    const raw = deviceCv();
    const before = structuredClone(raw);
    const prepared = prepareExportReadyCv(raw, 'es', 'modern-minimal', { referenceDate: '2026-08-04' });
    expect(prepared.ok, JSON.stringify(prepared)).toBe(false);
    expect(raw).toEqual(before);
    if (!prepared.ok) {
      expect(prepared.reason).toBe('experience_localization_source_binding_missing');
      expect(prepared.stage).toBe('produce_localized_display');
      expect(prepared.diagnostics.experienceProvenance).toHaveLength(2);
      expect(prepared.diagnostics.experienceProvenance.every((row) => (
        row.source === 'user_origin_recovered'
        && row.semanticDutyKeys.length === 3
      ))).toBe(true);
    }
    if (prepared.ok) {
      const projected = prepared.cv.experience.map((exp) => splitExperienceBullets(exp.description));
      expect(projected[0]).not.toEqual(STALE_DESIGN_ES);
      expect(projected[1]).not.toEqual(STALE_DESIGN_ES);
    }
  });

  it('rebuilds immutable per-entry facts from the current visible manual clauses', () => {
    const raw = deviceCv();
    const bicycle = recoverSemanticDutiesFromUserOrigin(raw.experience[0], raw.canonicalSnapshot);
    const reception = recoverSemanticDutiesFromUserOrigin(raw.experience[1], raw.canonicalSnapshot);
    expect(bicycle.duties.map((duty) => duty.sourceClause)).toEqual(BICYCLE_DE);
    expect(reception.duties.map((duty) => duty.sourceClause)).toEqual(RECEPTION_DE);
    expect(new Set(bicycle.duties.map((duty) => duty.key)).size).toBe(3);
    expect(bicycle.duties.map((duty) => duty.key)).not.toEqual(
      reception.duties.map((duty) => duty.key),
    );
    expect(bicycle.duties.every((duty) => duty.experienceId === 'exp-bicycle')).toBe(true);
    expect(reception.duties.every((duty) => duty.experienceId === 'exp-reception')).toBe(true);
    expect([...bicycle.duties, ...reception.duties].every((duty) => duty.sourceLocale === 'de')).toBe(true);
  });

  it('AAB-400 resolves current German duties before matching stale canonical locale metadata', () => {
    const raw = deviceCv();
    raw.canonicalSnapshot = {
      ...raw.canonicalSnapshot!,
      canonicalLocale: 'en',
      canonicalExperiences: raw.experience.map((exp) => ({
        experienceId: exp.id,
        role: exp.position,
        company: exp.company,
        bullets: splitExperienceBullets(exp.description).map((sourceText, order) => ({
          factId: `stale-en-${exp.id}-${order}`,
          semanticCategory: 'generic',
          sourceText,
          order,
        })),
      })),
    };

    const snapshot = buildExperienceLocalizationSnapshot(raw, 'es');
    expect(snapshot.ok).toBe(true);
    expect(snapshot.records).toHaveLength(6);
    expect(snapshot.records.every((record) => record.sourceLocale === 'de')).toBe(true);
    expect(Object.values(snapshot.diagnostics.sourceLocaleByEntry)).toEqual(['de', 'de']);
    expect(Object.values(snapshot.diagnostics.sourceLocaleResolutionByEntry))
      .toEqual(['current_authoritative_text', 'current_authoritative_text']);
  });

  it('BLOCKER-01 keeps classifier-recognized stale original/canonical duties out of PDF and DOCX', async () => {
    const staleDescription = bullets(BLOCKER_STALE_COOKING_EN);
    const currentDescription = bullets(BLOCKER_CURRENT_RECEPTION_EN);
    const staleBase: CVData = {
      id: 'aab399-blocker01-cv', name: 'BLOCKER-01 CV', templateId: 'modern-minimal', region: 'EU',
      personal: {
        fullName: 'Current Source Person', email: 'current@example.test', phone: '', address: '',
        jobTitle: 'Hotel Receptionist', photoEnabled: false,
      },
      summary: 'Recepcionista de hotel con experiencia en atención a huéspedes y reservas.',
      canonicalSummary: 'Recepcionista de hotel con experiencia en atención a huéspedes y reservas.',
      summaryOrigin: 'user', contentLocale: 'es', runtimeMigrationVersion: 3,
      experience: [{
        id: 'blocker01-reception-entry', position: 'Hotel Receptionist', company: 'Current Hotel',
        startDate: '2024-01', endDate: '', isPresent: true,
        description: staleDescription,
        originalUserDescription: staleDescription,
        canonicalDescription: staleDescription,
        descriptionOrigin: 'user', descriptionSourceLocale: 'en',
      }],
      education: [], skills: [], certifications: [], languages: [],
      createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z',
    };
    let currentCv: CVData = {
      ...staleBase,
      canonicalSnapshot: buildCanonicalSnapshotFromCv(staleBase, {
        canonicalLocale: 'en', createdFrom: 'legacy_migration', revision: 1, state: 'valid',
      }),
    };
    let providerCalls = 0;
    const adapter = async (request: ExperienceLocalizationRequest) => {
      providerCalls += 1;
      const translated = request.records[0]?.sourceText === BLOCKER_STALE_COOKING_EN[0]
        ? BLOCKER_STALE_COOKING_ES
        : BLOCKER_CURRENT_RECEPTION_ES;
      const records: ExperienceLocalizationProviderRecord[] = request.records.map((record) => ({
        ...record,
        localizedText: translated[record.sourceClauseIndex],
        semanticValidation: passedSemanticValidation(),
      }));
      return {
        snapshotId: request.snapshotId,
        targetLocale: request.targetLocale,
        records,
        provenance: 'provider' as const,
        independentVerification: passedIndependentVerification(request, records),
      };
    };
    const persist = (nextCv: CVData) => {
      currentCv = nextCv;
      return true;
    };

    const seededStale = await prepareExperienceLocalizedSurfaces({
      cv: currentCv, targetLocale: 'es', adapter, getCurrentCv: () => currentCv, persist,
    });
    expect(seededStale.ok).toBe(true);
    expect(providerCalls).toBe(1);
    const staleBindingKeys = new Set(Object.keys(currentCv.experienceLocalizedSurfaces?.surfaces || {}));
    expect(staleBindingKeys.size).toBe(3);

    currentCv = {
      ...currentCv,
      experience: currentCv.experience.map((exp) => ({
        ...exp,
        description: currentDescription,
      })),
    };
    const persistedSourceBefore = currentCv.experience[0].description;
    const persistedOriginalBefore = currentCv.experience[0].originalUserDescription;
    const persistedCanonicalBefore = currentCv.experience[0].canonicalDescription;
    const usageBefore = localStorage.getItem('cvpro-ai-usage');

    const grounding = resolveExperienceSemanticGrounding(currentCv.experience[0], {
      canonicalSnapshot: currentCv.canonicalSnapshot,
    });
    const expectedHashes = BLOCKER_CURRENT_RECEPTION_EN.map(hashUserOriginSourceClause);
    expect(grounding.source).toBe('user_origin_recovered');
    expect(grounding.duties.map((duty) => duty.sourceClause)).toEqual(BLOCKER_CURRENT_RECEPTION_EN);
    expect(grounding.duties.map((duty) => duty.sourceClauseHash)).toEqual(expectedHashes);
    expect(grounding.duties.every((duty) => duty.experienceId === 'blocker01-reception-entry')).toBe(true);
    expect(grounding.duties.every((duty) => duty.sourceFactId?.includes(duty.sourceClauseHash!))).toBe(true);
    expect(grounding.duties
      .map((duty) => duty.sourceClause)
      .filter((clause) => BLOCKER_STALE_COOKING_EN.includes(clause || ''))).toHaveLength(0);

    const acquiredCurrent = await prepareExperienceLocalizedSurfaces({
      cv: currentCv, targetLocale: 'es', adapter, getCurrentCv: () => currentCv, persist,
    });
    expect(acquiredCurrent.ok, JSON.stringify(acquiredCurrent)).toBe(true);
    expect(providerCalls).toBe(2);
    const currentSnapshot = buildExperienceLocalizationSnapshot(currentCv, 'es');
    expect(currentSnapshot.ok).toBe(true);
    expect(currentSnapshot.cachedSurfaces).toHaveLength(3);
    expect(currentSnapshot.missingRecords).toHaveLength(0);
    expect(currentSnapshot.records.every((record) => !staleBindingKeys.has(record.requestIdentity))).toBe(true);
    expect(currentSnapshot.records.map((record) => record.sourceClauseHash)).toEqual(expectedHashes);
    const titleChangedSnapshot = buildExperienceLocalizationSnapshot({
      ...currentCv,
      experience: currentCv.experience.map((exp) => ({ ...exp, position: 'Senior Hotel Receptionist' })),
    }, 'es');
    expect(titleChangedSnapshot.cachedSurfaces).toHaveLength(0);
    expect(titleChangedSnapshot.missingRecords).toHaveLength(3);

    const pdfPrepared = prepareExportReadyCv(currentCv, 'es', 'modern-minimal', {
      referenceDate: '2026-08-04', industry: 'hospitality', level: 'mid',
    });
    const docxPrepared = prepareExportReadyCv(currentCv, 'es', 'modern-minimal', {
      referenceDate: '2026-08-04', industry: 'hospitality', level: 'mid',
    });
    expect(pdfPrepared.ok, JSON.stringify(pdfPrepared)).toBe(true);
    expect(docxPrepared.ok, JSON.stringify(docxPrepared)).toBe(true);
    if (!pdfPrepared.ok || !docxPrepared.ok) return;
    const pdfFacts = splitExperienceBullets(pdfPrepared.cv.experience[0].description);
    const docxFacts = splitExperienceBullets(docxPrepared.cv.experience[0].description);
    expect(pdfFacts).toEqual(BLOCKER_CURRENT_RECEPTION_ES);
    expect(docxFacts).toEqual(BLOCKER_CURRENT_RECEPTION_ES);
    expect(pdfFacts).toEqual(docxFacts);
    const obsoleteDuties = new Set([...BLOCKER_STALE_COOKING_EN, ...BLOCKER_STALE_COOKING_ES]);
    expect([...pdfFacts, ...docxFacts].filter((fact) => obsoleteDuties.has(fact))).toHaveLength(0);

    const pdfBlob = await buildModernMinimalPdfBlob(pdfPrepared.cv, 'es');
    expect(pdfBlob.size).toBeGreaterThan(0);
    expect(pdfBlob.type).toBe('application/pdf');
    const blobs = mockDownload();
    const docx = await exportToDOCX(docxPrepared.cv, 'aab399-blocker01', 'es', 'modern-minimal');
    expect(docx.result).toBe('saved');
    expect(blobs.at(-1)?.size).toBeGreaterThan(0);
    expect(currentCv.experience[0].description).toBe(persistedSourceBefore);
    expect(currentCv.experience[0].originalUserDescription).toBe(persistedOriginalBefore);
    expect(currentCv.experience[0].canonicalDescription).toBe(persistedCanonicalBefore);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(usageBefore);
  }, 60_000);

  it('applies current-manual authority to exact/conflicting evidence and fails malformed current text closed', () => {
    const current = bullets(BLOCKER_CURRENT_RECEPTION_EN);
    const stale = bullets(BLOCKER_STALE_COOKING_EN);
    const base: WorkExperience = {
      id: 'authority-contract-entry', position: 'Hotel Receptionist', company: 'Contract Hotel',
      startDate: '2024-01', endDate: '', isPresent: true,
      description: current, originalUserDescription: current, canonicalDescription: current,
      descriptionOrigin: 'user', descriptionSourceLocale: 'en',
    };
    const cases: Array<[string, WorkExperience, string[], 'modern_provenance' | 'user_origin_recovered']> = [
      ['current exactly matches original and canonical', base, BLOCKER_CURRENT_RECEPTION_EN, 'user_origin_recovered'],
      ['classifier-recognized current exactly matches original and canonical', {
        ...base,
        description: stale,
        originalUserDescription: stale,
        canonicalDescription: stale,
      }, BLOCKER_STALE_COOKING_EN, 'modern_provenance'],
      ['current matches canonical but not original', {
        ...base, originalUserDescription: stale,
      }, BLOCKER_CURRENT_RECEPTION_EN, 'user_origin_recovered'],
      ['current differs from original and canonical at equal bullet count', {
        ...base, originalUserDescription: stale, canonicalDescription: stale,
      }, BLOCKER_CURRENT_RECEPTION_EN, 'user_origin_recovered'],
      ['only one current duty changed', {
        ...base,
        description: bullets([
          BLOCKER_CURRENT_RECEPTION_EN[0],
          'Verified reservation details and answered guest inquiries.',
          BLOCKER_CURRENT_RECEPTION_EN[2],
        ]),
        originalUserDescription: current,
        canonicalDescription: current,
      }, [
        BLOCKER_CURRENT_RECEPTION_EN[0],
        'Verified reservation details and answered guest inquiries.',
        BLOCKER_CURRENT_RECEPTION_EN[2],
      ], 'user_origin_recovered'],
      ['stale original is already in the selected target language', {
        ...base,
        originalUserDescription: bullets(BLOCKER_STALE_COOKING_ES),
        canonicalDescription: bullets(BLOCKER_STALE_COOKING_ES),
      }, BLOCKER_CURRENT_RECEPTION_EN, 'user_origin_recovered'],
    ];

    for (const [name, exp, expectedClauses, expectedSource] of cases) {
      const grounding = resolveExperienceSemanticGrounding(exp);
      expect(grounding.source, name).toBe(expectedSource);
      if (expectedSource === 'user_origin_recovered') {
        expect(grounding.duties.map((duty) => duty.sourceClause), name).toEqual(expectedClauses);
        expect(grounding.duties.map((duty) => duty.sourceClauseHash), name)
          .toEqual(expectedClauses.map(hashUserOriginSourceClause));
        expect(grounding.duties.flatMap((duty) => duty.sourceClause || []), name)
          .not.toEqual(expect.arrayContaining(BLOCKER_STALE_COOKING_EN));
      }
    }

    for (const malformedDescription of ['', '- --\n- ---\n- ...']) {
      const grounding = resolveExperienceSemanticGrounding({
        ...base,
        description: malformedDescription,
        originalUserDescription: stale,
        canonicalDescription: stale,
      });
      expect(grounding.source, malformedDescription || 'empty').toBe('none');
      expect(grounding.duties, malformedDescription || 'empty').toEqual([]);
      expect(grounding.recoveryFailureReason, malformedDescription || 'empty')
        .toBe('legacy_user_origin_recovery_insufficient_source');
    }

    for (const origin of ['ai_generated', 'unknown'] as const) {
      expect(recoverSemanticDutiesFromUserOrigin({ ...base, descriptionOrigin: origin }).source)
        .toBe('none');
    }

    const duplicateIdCv: CVData = {
      id: 'duplicate-entry-id-cv', name: 'Duplicate ID CV', templateId: 'modern-minimal', region: 'EU',
      personal: { fullName: 'Duplicate Test', email: '', phone: '', address: '', jobTitle: 'Service', photoEnabled: false },
      summary: '', experience: [
        base,
        {
          ...base,
          position: 'Guest Services Coordinator',
          company: 'Second Hotel',
          description: bullets(BLOCKER_CURRENT_RECEPTION_EN.map((duty) => `Second entry: ${duty}`)),
          originalUserDescription: bullets(BLOCKER_CURRENT_RECEPTION_EN.map((duty) => `Second entry: ${duty}`)),
          canonicalDescription: bullets(BLOCKER_CURRENT_RECEPTION_EN.map((duty) => `Second entry: ${duty}`)),
        },
      ],
      education: [], skills: [], certifications: [], languages: [],
      createdAt: '2024-01-01', updatedAt: '2026-08-04', runtimeMigrationVersion: 3,
    };
    const duplicateSnapshot = buildExperienceLocalizationSnapshot(duplicateIdCv, 'es');
    expect(duplicateSnapshot.records).toHaveLength(6);
    expect(new Set(duplicateSnapshot.records.map((record) => record.requestIdentity)).size).toBe(6);
  });

  it('applies one source-bound decision across all 144 ordered locale pairs', () => {
    const locales: Locale[] = ['en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja'];
    let total = 0;
    let cross = 0;
    let same = 0;
    for (const sourceLocale of locales) {
      const description = bullets([
        sourceLocale === 'en' ? 'Managed assigned projects.' : `zz-${sourceLocale}-01`,
        sourceLocale === 'en' ? 'Reviewed assigned materials.' : `zz-${sourceLocale}-02`,
        sourceLocale === 'en' ? 'Prepared assigned records.' : `zz-${sourceLocale}-03`,
      ]);
      const exp: WorkExperience = {
        id: `entry-${sourceLocale}`, company: `Company ${sourceLocale}`, position: `Role ${sourceLocale}`,
        startDate: '2020-01', endDate: '', isPresent: true,
        description, originalUserDescription: description, canonicalDescription: description,
        descriptionOrigin: 'user', descriptionSourceLocale: sourceLocale,
        descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(description),
      };
      const grounding = recoverSemanticDutiesFromUserOrigin(exp);
      expect(grounding.duties).toHaveLength(3);
      expect(grounding.duties.every((duty) => duty.sourceLocale === sourceLocale)).toBe(true);
      for (const targetLocale of locales) {
        const needsBoundSurface = recoveredUserOriginNeedsSourceBoundLocalization(grounding, targetLocale);
        expect(needsBoundSurface).toBe(sourceLocale !== targetLocale);
        total += 1;
        if (needsBoundSurface) cross += 1;
        else same += 1;
      }
    }
    expect({ total, cross, same }).toEqual({ total: 144, cross: 132, same: 12 });
  });

  it('maps a missing trusted Experience localization to the Experience review message', () => {
    expect(resolveCvExportToastMappingKey('experience_localization_source_binding_missing', 'pdf'))
      .toBe('EXPERIENCE_FACTS_REVIEW');
    const message = formatCvExportIntegrityToast(
      { reason: 'experience_localization_source_binding_missing' },
      'es',
      'docx',
    );
    expect(message).toMatch(/experiencia|experiencias/i);
    expect(message).not.toMatch(/resumen/i);
  });

  it('acquires one de→es batch for PDF, persists six surfaces, and reuses them for DOCX and repeated PDF', async () => {
    const raw = deviceCv();
    // Exact AAB-399 device failure shape: the matching canonical snapshot
    // carries stale English locale metadata while its bound visible clauses
    // are the current German Fahrradmechaniker/Rezeptionist duties.
    raw.canonicalSnapshot = {
      ...raw.canonicalSnapshot!,
      canonicalLocale: 'en',
      canonicalExperiences: raw.experience.map((exp) => ({
        experienceId: exp.id,
        role: exp.position,
        company: exp.company,
        bullets: splitExperienceBullets(exp.description).map((sourceText, order) => ({
          factId: `device-current-${exp.id}-${order}`,
          semanticCategory: 'generic',
          sourceText,
          order,
        })),
      })),
    };
    const visibleBefore = raw.experience.map((exp) => exp.description);
    const canonicalBefore = structuredClone(raw.canonicalSnapshot);
    let currentCv = raw;
    let translationCalls = 0;
    let verifierCalls = 0;
    const adapter = async (request: ExperienceLocalizationRequest) => {
      translationCalls += 1;
      const records: ExperienceLocalizationProviderRecord[] = request.records.map((record) => ({
        ...record,
        localizedText: (record.experienceId === 'exp-bicycle' ? BICYCLE_ES : RECEPTION_ES)[record.sourceClauseIndex],
        semanticValidation: passedSemanticValidation(),
      }));
      verifierCalls += 1;
      return {
        snapshotId: request.snapshotId,
        targetLocale: request.targetLocale,
        records,
        provenance: 'provider' as const,
        independentVerification: passedIndependentVerification(request, records),
      };
    };

    const first = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      adapter,
      getCurrentCv: () => currentCv,
      persist: (nextCv) => {
        currentCv = nextCv;
        return true;
      },
    });
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (!first.ok) return;
    expect(translationCalls).toBe(1);
    expect(verifierCalls).toBe(1);
    expect(first.diagnostics.providerRequestCount).toBe(1);
    expect(first.diagnostics.independentVerifierRequestCount).toBe(1);
    expect(first.diagnostics.persistedSurfaceCount).toBe(6);
    expect(Object.values(first.diagnostics.sourceLocaleByEntry)).toEqual(['de', 'de']);
    expect(Object.values(first.diagnostics.sourceLocaleResolutionByEntry))
      .toEqual(['current_authoritative_text', 'current_authoritative_text']);
    expect(Object.keys(currentCv.experienceLocalizedSurfaces?.surfaces || {})).toHaveLength(6);
    expect(currentCv.experience.map((exp) => exp.description)).toEqual(visibleBefore);
    expect(currentCv.canonicalSnapshot).toEqual(canonicalBefore);

    const pdfPrepared = prepareExportReadyCv(currentCv, 'es', 'modern-minimal', { referenceDate: '2026-08-04' });
    expect(pdfPrepared.ok, JSON.stringify(pdfPrepared)).toBe(true);
    if (!pdfPrepared.ok) return;
    expect(pdfPrepared.cv.experience.map((exp) => splitExperienceBullets(exp.description)))
      .toEqual([BICYCLE_ES, RECEPTION_ES]);
    expect(pdfPrepared.cv.experience.flatMap((exp) => splitExperienceBullets(exp.description)))
      .not.toEqual(expect.arrayContaining(STALE_DESIGN_ES));
    const pdfBlob = await buildModernMinimalPdfBlob(pdfPrepared.cv, 'es');
    expect(pdfBlob.size).toBeGreaterThan(0);

    const afterPdf = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      adapter,
      getCurrentCv: () => currentCv,
      persist: () => {
        throw new Error('cache hit must not persist');
      },
    });
    expect(afterPdf.ok).toBe(true);
    expect(translationCalls).toBe(1);
    expect(verifierCalls).toBe(1);
    expect(afterPdf.diagnostics.cacheReuseCount).toBe(6);
    const docxPrepared = prepareExportReadyCv(currentCv, 'es', 'modern-minimal', { referenceDate: '2026-08-04' });
    expect(docxPrepared.ok).toBe(true);
    if (!docxPrepared.ok) return;
    const blobs = mockDownload();
    const docx = await exportToDOCX(docxPrepared.cv, 'aab399-device', 'es', 'modern-minimal');
    expect(docx.result).toBe('saved');
    expect(blobs.at(-1)?.size).toBeGreaterThan(0);
    expect(docxPrepared.cv.experience.map((exp) => exp.description))
      .toEqual(pdfPrepared.cv.experience.map((exp) => exp.description));

    const repeated = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      adapter,
      getCurrentCv: () => currentCv,
      persist: () => false,
    });
    expect(repeated.ok).toBe(true);
    expect(translationCalls).toBe(1);
    expect(verifierCalls).toBe(1);
    const repeatedPrepared = prepareExportReadyCv(currentCv, 'es', 'modern-minimal', { referenceDate: '2026-08-04' });
    expect(repeatedPrepared.ok).toBe(true);
    if (!repeatedPrepared.ok) return;
    const repeatedPdf = await buildModernMinimalPdfBlob(repeatedPrepared.cv, 'es');
    expect(repeatedPdf.size).toBeGreaterThan(0);
    expect(repeatedPrepared.cv.experience.map((exp) => exp.description))
      .toEqual(pdfPrepared.cv.experience.map((exp) => exp.description));
    expect(currentCv.experience.map((exp) => exp.description)).toEqual(visibleBefore);
    expect(currentCv.canonicalSnapshot).toEqual(canonicalBefore);
    expect(localStorage.getItem('cvpro-ai-usage')).toBeNull();
  }, 60_000);

  it.each([
    ['bicycle', 'exp-bicycle', 0],
    ['reception', 'exp-reception', 3],
  ] as const)('rejects graphic-design substitution for %s as one atomic batch', async (
    _name,
    experienceId,
    recordIndex,
  ) => {
    const raw = deviceCv();
    const before = structuredClone(raw);
    const blobs = mockDownload();
    let persistCalls = 0;
    const result = await prepareExperienceLocalizedSurfaces({
      cv: raw,
      targetLocale: 'es',
      adapter: async (request) => {
        const records: ExperienceLocalizationProviderRecord[] = request.records.map((record, index) => ({
          ...record,
          localizedText: index === recordIndex
            ? STALE_DESIGN_ES[0]
            : (record.experienceId === 'exp-bicycle' ? BICYCLE_ES : RECEPTION_ES)[record.sourceClauseIndex],
          semanticValidation: passedSemanticValidation(),
        }));
        const independentVerification = passedIndependentVerification(request, records);
        const verdict = independentVerification.records[recordIndex];
        verdict.decision = 'rejected';
        verdict.mismatchCategory = 'cross_occupation_substitution';
        verdict.predicatePreserved = false;
        verdict.objectPreserved = false;
        verdict.workDomainPreserved = false;
        verdict.sourceResponsibilityPreserved = false;
        verdict.crossOccupationSubstitution = true;
        return {
          snapshotId: request.snapshotId,
          targetLocale: request.targetLocale,
          records,
          independentVerification,
        };
      },
      getCurrentCv: () => raw,
      persist: () => {
        persistCalls += 1;
        return true;
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('experience_localization_independent_semantic_validation_failed');
      expect(result.stage).toBe('validate_localized_surfaces');
      expect(result.diagnostics.validatedRecordCount).toBe(0);
      expect(result.diagnostics.persistedSurfaceCount).toBe(0);
    }
    expect(result.snapshot.records.some((record) => record.experienceId === experienceId)).toBe(true);
    expect(persistCalls).toBe(0);
    expect(blobs).toHaveLength(0);
    expect(raw).toEqual(before);
    expect(localStorage.getItem('cvpro-ai-usage')).toBeNull();
  });

  function largeBatchCv(recordCount: number): CVData {
    const raw = deviceCv();
    const description = bullets(Array.from(
      { length: recordCount },
      () => BICYCLE_DE[0],
    ));
    return {
      ...raw,
      canonicalSnapshot: undefined,
      experience: [{
        ...raw.experience[0],
        description,
        originalUserDescription: description,
        canonicalDescription: description,
        descriptionOrigin: 'user',
        descriptionSourceLocale: 'de',
      }],
    };
  }

  function batchResponse(request: ExperienceLocalizationRequest) {
    const records: ExperienceLocalizationProviderRecord[] = request.records.map((record) => ({
      ...record,
      localizedText: BICYCLE_ES[0],
      semanticValidation: passedSemanticValidation(),
    }));
    return {
      snapshotId: request.snapshotId,
      targetLocale: request.targetLocale,
      records,
      providerAttemptCount: 1,
      independentVerification: passedIndependentVerification(request, records),
    };
  }

  it.each([1, 6, 12, 13, 24])(
    'batches %s missing records deterministically and persists once',
    async (recordCount) => {
      let currentCv = largeBatchCv(recordCount);
      let adapterCalls = 0;
      let persistCalls = 0;
      const result = await prepareExperienceLocalizedSurfaces({
        cv: currentCv,
        targetLocale: 'es',
        adapter: async (request, context) => {
          adapterCalls += 1;
          expect(context?.batchIndex).toBe(adapterCalls - 1);
          expect(request.records.length).toBeLessThanOrEqual(EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE);
          return batchResponse(request);
        },
        getCurrentCv: () => currentCv,
        persist: (nextCv) => {
          persistCalls += 1;
          currentCv = nextCv;
          return true;
        },
      });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(adapterCalls).toBe(Math.ceil(recordCount / EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE));
      expect(persistCalls).toBe(1);
      expect(result.diagnostics.persistedSurfaceCount).toBe(recordCount);
      expect(result.diagnostics.providerRequestCount).toBe(adapterCalls);
      expect(result.diagnostics.independentVerifierRequestCount).toBe(adapterCalls);
    },
  );

  it('discards batch 1 when batch 2 fails and never persists', async () => {
    const currentCv = largeBatchCv(13);
    let calls = 0;
    let persistCalls = 0;
    const result = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      adapter: async (request) => {
        calls += 1;
        if (calls === 2) throw new Error('verifier_transport_timeout');
        return batchResponse(request);
      },
      getCurrentCv: () => currentCv,
      persist: () => { persistCalls += 1; return true; },
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(2);
    expect(persistCalls).toBe(0);
    expect(result.diagnostics.persistedSurfaceCount).toBe(0);
  });

  it('discards every batch when the full source snapshot changes between batches', async () => {
    let currentCv = largeBatchCv(13);
    let calls = 0;
    let persistCalls = 0;
    const result = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      adapter: async (request) => {
        calls += 1;
        const response = batchResponse(request);
        if (calls === 2) {
          currentCv = {
            ...currentCv,
            experience: currentCv.experience.map((exp) => ({
              ...exp,
              description: `${exp.description}\n- PrÃ¼ft zusÃ¤tzliche FahrrÃ¤der.`,
            })),
          };
        }
        return response;
      },
      getCurrentCv: () => currentCv,
      persist: () => { persistCalls += 1; return true; },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('experience_localization_stale_snapshot');
    expect(persistCalls).toBe(0);
  });

  it('processes more than the former aggregate cap through bounded batches and one atomic persist', async () => {
    const count = 301;
    let currentCv = largeBatchCv(count);
    let calls = 0;
    let persistCalls = 0;
    const result = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      adapter: async (request) => { calls += 1; return batchResponse(request); },
      getCurrentCv: () => currentCv,
      persist: (nextCv) => { persistCalls += 1; currentCv = nextCv; return true; },
    });
    expect(result.ok).toBe(true);
    expect(calls).toBe(Math.ceil(count / EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE));
    expect(persistCalls).toBe(1);
  });

  it('rolls back atomically when batch 50 of a 301-record operation fails', async () => {
    const count = 301;
    const currentCv = largeBatchCv(count);
    const before = structuredClone(currentCv);
    let calls = 0;
    let persistCalls = 0;
    const result = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      adapter: async (request) => {
        calls += 1;
        if (calls === 50) throw new Error('verifier_transport_timeout');
        return batchResponse(request);
      },
      getCurrentCv: () => currentCv,
      persist: () => { persistCalls += 1; return true; },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('verifier_transport_timeout');
      expect(result.stage).toBe('acquire_localized_surfaces');
    }
    expect(calls).toBe(50);
    expect(persistCalls).toBe(0);
    expect(result.diagnostics.persistedSurfaceCount).toBe(0);
    expect(currentCv).toEqual(before);
    expect(localStorage.getItem('cvpro-ai-usage')).toBeNull();
  });

  it('fails a bounded operation deadline without persistence or usage', async () => {
    const currentCv = largeBatchCv(13);
    let clock = 0;
    let calls = 0;
    let persistCalls = 0;
    const result = await prepareExperienceLocalizedSurfaces({
      cv: currentCv,
      targetLocale: 'es',
      operationDeadlineAt: 100,
      now: () => clock,
      adapter: async (request) => {
        calls += 1;
        clock = 101;
        return batchResponse(request);
      },
      getCurrentCv: () => currentCv,
      persist: () => { persistCalls += 1; return true; },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('experience_localization_operation_deadline_exceeded');
      expect(result.stage).toBe('operation_deadline');
    }
    expect(calls).toBe(1);
    expect(persistCalls).toBe(0);
    expect(result.diagnostics.persistedSurfaceCount).toBe(0);
    expect(localStorage.getItem('cvpro-ai-usage')).toBeNull();
  });

});
