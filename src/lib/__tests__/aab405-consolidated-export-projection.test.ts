import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  prepareExportLocalizedTitles,
  CV_EXPORT_TITLE_LOCALIZATION_REVISION,
  type ExportTitleLocalizationTransportInput,
} from '@/lib/cv-export-title-localization';
import {
  buildPersistableCvAfterExportPreparation,
  exportDraftVisibleContentPreserved,
  CV_EXPORT_DRAFT_ISOLATION_REVISION,
} from '@/lib/cv-export-draft-isolation';
import {
  buildCvExportRenderProjection,
  collectCvStructuredTextTokens,
  normalizeNarrativeWithProtectedStructuredTokens,
  normalizeStructuredExportText,
} from '@/lib/cv-export-structured-text';
import { mmNormalizePdfText } from '@/lib/modern-minimal-pdf-renderer';
import { projectExperienceFromLocalizedSurfaces } from '@/lib/cv-experience-localized-surfaces';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { compactSavedSummaryNearWordBudget } from '@/lib/cv-summary-word-budget';
import { countSummaryWords } from '@/lib/cv-summary-grounding';
import type { ExperienceSemanticGrounding } from '@/lib/cv-semantic-duty-facts';

function experience(
  id: string,
  position: string,
  company: string,
  description: string,
  isPresent = false,
): WorkExperience {
  return {
    id,
    position,
    company,
    startDate: '2023-01',
    endDate: isPresent ? '' : '2025-12',
    isPresent,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'de',
    positionSourceLocale: 'de',
    positionProvenance: 'manual',
    positionUserEdited: true,
  };
}

function fixture(): CVData {
  return {
    id: 'aab405-cv',
    name: 'John wayn',
    personal: {
      fullName: 'John wayn',
      email: 'john@example.test',
      phone: '337373737',
      address: 'xjdjdjxh',
      jobTitle: 'Koordinator für E-Bike-Service und Kundenannahme',
      gender: 'male',
    },
    summary: 'Profesional con experiencia en coordinación de servicios para bicicletas eléctricas. Actualmente trabaja en RadWerk y anteriormente trabajó en StadtHotel.',
    canonicalSummary: 'Profesional con experiencia en coordinación de servicios para bicicletas eléctricas. Actualmente trabaja en RadWerk y anteriormente trabajó en StadtHotel.',
    summaryOrigin: 'user',
    contentLocale: 'es',
    experience: [
      experience(
        'current',
        'Koordinator für E-Bike-Service und Kundenannahme',
        'RadWerk',
        '- Koordiniert Wartungstermine für E-Bikes.\n- Prüft eingehende Fahrräder.\n- Erklärt Reparaturschritte.',
        true,
      ),
      experience(
        'prior',
        'Mitarbeiter für Gästeempfang und Reservierungsverwaltung',
        'StadtHotel',
        '- Begrüßte Gäste.\n- Verwaltete Reservierungen.\n- Beantwortete Anfragen.',
      ),
      experience('bike', 'Fahrradmechaniker', 'RadWerk', '- Prüft Fahrräder.'),
      experience('hotel', 'Rezeptionist', 'StadtHotel', '- Begrüßte Gäste.'),
    ],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01',
    updatedAt: '2026-08-07',
    runtimeMigrationVersion: 3,
  };
}

const translations = new Map<string, string>([
  ['Koordinator für E-Bike-Service und Kundenannahme', 'Coordinador de servicio de bicicletas eléctricas y atención al cliente'],
  ['Mitarbeiter für Gästeempfang und Reservierungsverwaltung', 'Empleado de recepción de huéspedes y gestión de reservas'],
  ['Fahrradmechaniker', 'Mecánico de bicicletas'],
  ['Rezeptionist', 'Recepcionista'],
]);

function titleAdapter(spy?: ReturnType<typeof vi.fn>) {
  return async (input: ExportTitleLocalizationTransportInput) => {
    spy?.(input);
    return {
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: translations.get(entry.roleTitle) || `ES ${entry.roleTitle}`,
        facts: [],
      })),
    };
  };
}

describe('AAB-405 consolidated export projection', () => {
  it('localizes header and arbitrary/manual Experience titles while preserving exact employers', async () => {
    const source = fixture();
    const providerSpy = vi.fn();
    const exportCv = structuredClone(source);
    exportCv.summary = [
      'Actualmente trabaja como Koordinator für E-Bike-Service und Kundenannahme en RadWerk.',
      'Anteriormente trabajó como Mitarbeiter für Gästeempfang und Reservierungsverwaltung en StadtHotel.',
    ].join(' ');
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv,
      targetLocale: 'es',
      gender: 'male',
      adapter: titleAdapter(providerSpy),
      getCurrentCv: () => source,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(result.exportCv.personal.jobTitle)
      .toBe('Coordinador de servicio de bicicletas eléctricas y atención al cliente');
    expect(result.exportCv.experience.map((entry) => entry.position)).toEqual([
      'Coordinador de servicio de bicicletas eléctricas y atención al cliente',
      'Empleado de recepción de huéspedes y gestión de reservas',
      'Mecánico de bicicletas',
      'Recepcionista',
    ]);
    expect(result.exportCv.experience.map((entry) => entry.company))
      .toEqual(['RadWerk', 'StadtHotel', 'RadWerk', 'StadtHotel']);
    expect(result.exportCv.summary).toContain(
      'Coordinador de servicio de bicicletas eléctricas y atención al cliente',
    );
    expect(result.exportCv.summary).toContain(
      'Empleado de recepción de huéspedes y gestión de reservas',
    );
    expect(result.exportCv.summary).not.toContain('Koordinator für');
    expect(result.exportCv.summary).not.toContain('Mitarbeiter für');
    expect(source.personal.jobTitle).toBe('Koordinator für E-Bike-Service und Kundenannahme');
    expect(source.experience[0].position).toBe('Koordinator für E-Bike-Service und Kundenannahme');
    expect(result.diagnostics).toMatchObject({
      titleLocalizationRevision: CV_EXPORT_TITLE_LOCALIZATION_REVISION,
      titleFieldCount: 5,
      titleUniqueSourceCount: 4,
      titleProviderRequestCount: 1,
      titleProjectionPassed: true,
      employerIdentityPassed: true,
      titleSummaryMentionReplacementCount: 2,
    });
  });

  it('reuses persisted title surfaces and never calls the provider on the second export', async () => {
    const source = fixture();
    const first = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      adapter: titleAdapter(),
      getCurrentCv: () => source,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const providerSpy = vi.fn();
    const second = await prepareExportLocalizedTitles({
      sourceCv: first.persistableCv,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      adapter: titleAdapter(providerSpy),
      getCurrentCv: () => first.persistableCv,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const persistedSurfaceCount = Object.keys(
      first.persistableCv.exportLocalizedTitleSurfaces?.surfaces || {},
    ).length;
    expect(persistedSurfaceCount).toBeGreaterThan(0);
    expect(providerSpy).not.toHaveBeenCalled();
    expect(second.diagnostics.titleCacheReuseCount).toBe(persistedSurfaceCount);
    expect(second.diagnostics.titleProviderRequestCount).toBe(0);
    expect(
      second.diagnostics.titleCacheReuseCount
      + second.diagnostics.titleDeterministicCount
      + second.diagnostics.titleSameLocaleCount,
    ).toBe(second.diagnostics.titleUniqueSourceCount);
  });

  it('batches more than eight unique free-text titles without cross-entry mixing', async () => {
    const source = fixture();
    source.personal.jobTitle = 'Titel 0 für Kundenservice';
    source.experience = Array.from({ length: 9 }, (_, index) => experience(
      `entry-${index}`,
      `Titel ${index} für Kundenservice`,
      `Company${index}`,
      '- Prüft Unterlagen.',
      index === 0,
    ));
    const calls: ExportTitleLocalizationTransportInput[] = [];
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      adapter: async (input) => {
        calls.push(input);
        return {
          targetLocale: 'es',
          entries: input.entries.map((entry) => ({
            entryId: entry.entryId,
            localizedRoleTitle: `Título localizado ${entry.roleTitle.match(/\d+/u)?.[0] || '0'}`,
            facts: [],
          })),
        };
      },
      getCurrentCv: () => source,
    });
    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.entries.length)).toEqual([8, 1]);
    expect(new Set(result.ok ? result.exportCv.experience.map((entry) => entry.position) : []).size)
      .toBe(9);
  });

  it.each([
    ['en', 'Electric bicycle service coordinator'],
    ['es', 'Coordinador de servicio de bicicletas eléctricas'],
    ['fr', 'Coordinateur du service de vélos électriques'],
    ['it', 'Coordinatore del servizio biciclette elettriche'],
    ['ar', 'منسق خدمة الدراجات الكهربائية'],
    ['sr', 'Koordinator servisa električnih bicikala'],
    ['hr', 'Koordinator servisa električnih bicikala'],
    ['ru', 'Координатор сервиса электровелосипедов'],
    ['pt-BR', 'Coordenador de serviço de bicicletas elétricas'],
    ['hi', 'इलेक्ट्रिक साइकिल सेवा समन्वयक'],
    ['ja', '電動自転車サービスコーディネーター'],
  ] as const)(
    'localizes arbitrary free-text titles into supported target locale %s',
    async (targetLocale: Locale, localizedTitle: string) => {
      const source = fixture();
      source.personal.jobTitle = 'Koordinator für Spezialservice';
      source.experience = [experience(
        'current',
        'Koordinator für Spezialservice',
        'RadWerk',
        '- Koordiniert Servicetermine.',
        true,
      )];
      const result = await prepareExportLocalizedTitles({
        sourceCv: source,
        exportCv: structuredClone(source),
        targetLocale,
        adapter: async (input) => ({
          targetLocale,
          entries: input.entries.map((entry) => ({
            entryId: entry.entryId,
            localizedRoleTitle: localizedTitle,
            facts: [],
          })),
        }),
        getCurrentCv: () => source,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.exportCv.personal.jobTitle).toBe(localizedTitle);
      expect(result.exportCv.experience[0].position).toBe(localizedTitle);
      expect(result.exportCv.experience[0].company).toBe('RadWerk');
    },
  );

  it('fails closed when visible editor content changes during title localization', async () => {
    const source = fixture();
    source.personal.jobTitle = 'Koordinator für Spezialservice';
    source.experience = [experience(
      'current',
      'Koordinator für Spezialservice',
      'RadWerk',
      '- Koordiniert Servicetermine.',
      true,
    )];
    let current = structuredClone(source);
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      adapter: async (input) => {
        current = { ...current, summary: `${current.summary} Concurrent edit.` };
        return {
          targetLocale: 'es',
          entries: input.entries.map((entry) => ({
            entryId: entry.entryId,
            localizedRoleTitle: 'Coordinador de servicio especializado',
            facts: [],
          })),
        };
      },
      getCurrentCv: () => current,
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.reason).toBe('export_title_localization_stale_snapshot');
  });

  it('invalidates a cached title surface after a material source-title edit', async () => {
    const source = fixture();
    source.personal.jobTitle = 'Koordinator für Spezialservice';
    source.experience = [experience(
      'current',
      'Koordinator für Spezialservice',
      'RadWerk',
      '- Koordiniert Servicetermine.',
      true,
    )];
    const first = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      adapter: async (input) => ({
        targetLocale: 'es',
        entries: input.entries.map((entry) => ({
          entryId: entry.entryId,
          localizedRoleTitle: 'Coordinador de servicio especializado',
          facts: [],
        })),
      }),
      getCurrentCv: () => source,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const edited = structuredClone(first.persistableCv);
    edited.personal.jobTitle = 'Koordinator für Premium-Service';
    edited.experience[0].position = 'Koordinator für Premium-Service';
    const providerSpy = vi.fn();
    const second = await prepareExportLocalizedTitles({
      sourceCv: edited,
      exportCv: structuredClone(edited),
      targetLocale: 'es',
      adapter: async (input) => {
        providerSpy(input);
        return {
          targetLocale: 'es',
          entries: input.entries.map((entry) => ({
            entryId: entry.entryId,
            localizedRoleTitle: 'Coordinador de servicio premium',
            facts: [],
          })),
        };
      },
      getCurrentCv: () => edited,
    });
    expect(second.ok).toBe(true);
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(second.ok && second.exportCv.personal.jobTitle)
      .toBe('Coordinador de servicio premium');
  });

  it('uses authoritative original duties when legacy current descriptions carry the target locale', async () => {
    const source = fixture();
    source.contentLocale = 'es';
    source.personal.jobTitle = 'Koordinator für Spezialservice';
    source.experience = [experience(
      'current',
      'Koordinator für Spezialservice',
      'RadWerk',
      '- Prüft Fahrräder und dokumentiert technische Probleme.',
      true,
    )];
    source.experience[0].description = '- Inspecciona bicicletas y documenta problemas técnicos.';
    source.experience[0].descriptionSourceLocale = 'es';
    source.experience[0].positionSourceLocale = undefined;
    const providerSpy = vi.fn();
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      adapter: async (input) => {
        providerSpy(input);
        return {
          targetLocale: 'es',
          entries: input.entries.map((entry) => ({
            entryId: entry.entryId,
            localizedRoleTitle: 'Coordinador de servicio especializado',
            facts: [],
          })),
        };
      },
      getCurrentCv: () => source,
    });
    expect(result.ok).toBe(true);
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(result.ok && result.exportCv.personal.jobTitle)
      .toBe('Coordinador de servicio especializado');
    expect(result.ok && result.exportCv.experience[0].position)
      .toBe('Coordinador de servicio especializado');
  });

  it('keeps same-locale titles exact and uses no provider', async () => {
    const source = fixture();
    source.contentLocale = 'de';
    const providerSpy = vi.fn();
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'de',
      adapter: titleAdapter(providerSpy),
      getCurrentCv: () => source,
    });
    expect(result.ok).toBe(true);
    expect(providerSpy).not.toHaveBeenCalled();
    expect(result.ok && result.exportCv.experience.map((entry) => entry.position))
      .toEqual(source.experience.map((entry) => entry.position));
  });

  it('keeps Summary compaction and localized descriptions export-only', () => {
    const source = fixture();
    const prepared = structuredClone(source);
    prepared.summary = 'Compact export Summary.';
    prepared.summaryGeneratedLocale = 'es';
    prepared.experience[0].description = '- Descripción localizada.';
    prepared.experience[0].descriptionSourceLocale = 'es';
    prepared.experienceLocalizedSurfaces = { schemaVersion: 1, surfaces: {} };
    prepared.exportLocalizedTitleSurfaces = { schemaVersion: 1, surfaces: {} };

    const persisted = buildPersistableCvAfterExportPreparation(source, prepared);
    expect(exportDraftVisibleContentPreserved(source, persisted)).toBe(true);
    expect(persisted.summary).toBe(source.summary);
    expect(persisted.experience[0].description).toBe(source.experience[0].description);
    expect(persisted.experience[0].position).toBe(source.experience[0].position);
    expect(persisted.experienceLocalizedSurfaces).toEqual(prepared.experienceLocalizedSurfaces);
    expect(persisted.exportLocalizedTitleSurfaces).toEqual(prepared.exportLocalizedTitleSurfaces);
    expect(CV_EXPORT_DRAFT_ISOLATION_REVISION).toBe('cv-export-draft-isolation-405-v1');
  });

  it('preserves structured names while retaining normalizer boundary behavior', () => {
    const source = fixture();
    const tokens = [...collectCvStructuredTextTokens(source), 'Software engineer'];
    const normalized = normalizeNarrativeWithProtectedStructuredTokens(
      'Actualmente trabaja en RadWerk y anteriormente trabajó en StadtHotel.',
      tokens,
      (text) => mmNormalizePdfText(text, 'es'),
    );
    expect(normalized).toContain('RadWerk');
    expect(normalized).toContain('StadtHotel');
    expect(normalized).not.toContain('Rad. Werk');
    expect(normalized).not.toContain('Stadt. Hotel');
    expect(normalizeStructuredExportText('  RadWerk  ')).toBe('RadWerk');

    const boundaryNormalized = normalizeNarrativeWithProtectedStructuredTokens(
      'Built environments.Software engineer.Built release tooling.',
      tokens,
      (text) => mmNormalizePdfText(text, 'en'),
    );
    expect(boundaryNormalized).toContain('environments. Software engineer. Built');
    expect(boundaryNormalized).not.toContain('environments.Software engineer');
    expect(boundaryNormalized).not.toContain('Software engineer.Built');
    expect(boundaryNormalized).toContain('Software engineer');
  });

  it('keeps same-locale source descriptions exact and renders recovered duties as separate bullets', () => {
    const source = fixture();
    const exp = source.experience[0];
    const clauses = Array.from({ length: 13 }, (_, index) => `Aufgabe ${index + 1}.`);
    const originalDescription = clauses.join(' ');
    exp.description = originalDescription;
    const grounding: ExperienceSemanticGrounding = {
      source: 'user_origin_recovered',
      duties: clauses.map((sourceClause, index) => ({
        key: `user_origin_clause_${index}`,
        confidence: 'exact_user_origin',
        sourceClauseIndex: index,
        sourceClause,
        sourceLocale: 'de',
        sourceLocaleResolution: 'description_source_locale',
      })),
    };
    const projected = projectExperienceFromLocalizedSurfaces({
      cv: source,
      exp,
      grounding,
      targetLocale: 'de',
    });
    expect(projected).toBe(originalDescription);

    exp.groundingRecoverySource = 'legacy_user_origin_duties';
    exp.recoveredSemanticDuties = grounding.duties;
    const renderCv = buildCvExportRenderProjection(source, 'de');
    expect(splitExperienceBullets(renderCv.experience[0].description || '')).toHaveLength(13);
    expect(source.experience[0].description).toBe(originalDescription);
  });

  it('fails closed on conflicting recovered-duty locale provenance in the render-only projection', () => {
    const source = fixture();
    const exp = source.experience[0];
    const originalDescription = 'Aufgabe eins. Aufgabe zwei.';
    exp.description = originalDescription;
    exp.groundingRecoverySource = 'legacy_user_origin_duties';
    exp.recoveredSemanticDuties = [
      {
        key: 'user_origin_clause_0',
        confidence: 'exact_user_origin',
        sourceClauseIndex: 0,
        sourceClause: 'Aufgabe eins.',
        sourceLocale: 'de',
        sourceLocaleResolution: 'description_source_locale',
      },
      {
        key: 'user_origin_clause_1',
        confidence: 'exact_user_origin',
        sourceClauseIndex: 1,
        sourceClause: 'Tarea dos.',
        sourceLocale: 'es',
        sourceLocaleResolution: 'description_source_locale',
      },
    ];

    const renderCv = buildCvExportRenderProjection(source, 'de');
    expect(renderCv.experience[0].description).toBe(originalDescription);
    expect(source.experience[0].description).toBe(originalDescription);
  });

  it('wires one immutable PDF/DOCX export projection and independent title verification', () => {
    const page = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    const route = readFileSync('src/app/api/generate/route.ts', 'utf8');
    expect(page).toContain('prepareExportLocalizedTitles');
    expect(page).toContain('buildPersistableCvAfterExportPreparation');
    expect(page).toContain("action: 'export-title-localize'");
    expect(page).toContain('titlePostProjectionValidationPassed');
    expect(page).toContain('title_post_projection_validation');
    expect(page).not.toMatch(/cvRef\.current\s*=\s*(?:cvForExport|liveCv)\b/u);
    expect(route).toContain("if (action === 'export-title-localize')");
    expect(route).toContain('verify_export_job_title_localization');
    expect(route).toContain('export_title_localization_independent_verification_failed');
  });

  it('protects structured employer/title tokens across every direct PDF family and DOCX cleanup', () => {
    const renderers = [
      'modern-minimal-pdf-renderer.ts',
      'clean-simple-pdf-renderer.ts',
      'executive-premium-pdf-renderer.ts',
      'contemporary-bold-pdf-renderer.ts',
      'corporate-navy-pdf-renderer.ts',
      'tech-sidebar-pdf-renderer.ts',
      'rirekisho-pdf-renderer.ts',
    ];
    for (const renderer of renderers) {
      const source = readFileSync(`src/lib/${renderer}`, 'utf8');
      expect(source, renderer).toContain('cv-export-structured-text');
      expect(source, renderer).toContain('normalizeNarrativeWithProtectedStructuredTokens');
      expect(source, renderer).toContain('buildCvExportRenderProjection');
    }
    const docx = readFileSync('src/lib/export.ts', 'utf8');
    expect(docx).toContain('collectCvStructuredTextTokens');
    expect(docx).toContain('normalizeNarrativeWithProtectedStructuredTokens');
    expect(docx).toContain('buildCvExportRenderProjection');
    for (const builder of [
      'buildProfessionalClassicPagedPdfBlob',
      'buildCreativeBoldPagedPdfBlob',
      'buildCreativeArtisticPagedPdfBlob',
      'buildElegantFormalPagedPdfBlob',
      'buildAtsStandardPagedPdfBlob',
      'buildNordicCleanPagedPdfBlob',
    ]) {
      const start = docx.indexOf(`export async function ${builder}`);
      const end = docx.indexOf('\nexport async function ', start + 1);
      const branch = docx.slice(start, end > start ? end : undefined);
      expect(start, builder).toBeGreaterThanOrEqual(0);
      expect(branch, builder).toContain('buildCvExportRenderProjection');
    }

    const diagnostics = readFileSync('src/lib/cv-export-diagnostics.ts', 'utf8');
    expect(diagnostics).toContain('getExperienceExportRenderDescription');
    expect(diagnostics).toContain('CV_EXPORT_RENDER_DUTY_PROJECTION_REVISION');
    expect(diagnostics).toContain('renderDutyProjectionUsed');
  });

  it('keeps locale-aware Summary boundaries at 90, 94 and 110 words', () => {
    const words = (count: number) => Array.from({ length: count }, (_, index) => (
      index === 0 ? 'Profesional' : `palabra${index}`
    )).join(' ');
    expect(compactSavedSummaryNearWordBudget({
      summary: words(90), locale: 'es', validate: () => true,
    })).toBeNull();
    const compact94 = compactSavedSummaryNearWordBudget({
      summary: words(94), locale: 'es', validate: () => true,
    });
    expect(compact94?.wordCountBefore).toBe(94);
    expect(compact94?.wordCountAfter).toBeLessThanOrEqual(90);
    const compact110 = compactSavedSummaryNearWordBudget({
      summary: words(110), locale: 'es', validate: () => true,
    });
    expect(compact110?.wordCountBefore).toBe(110);
    expect(compact110?.wordCountAfter).toBeLessThanOrEqual(90);
    expect(countSummaryWords(compact110?.text || '', 'es')).toBeLessThanOrEqual(90);
  });
});
