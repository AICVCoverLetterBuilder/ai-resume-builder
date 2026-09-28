import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  classifyExportLocalizedTitleFailure,
  prepareExportLocalizedTitles,
  type ExportTitleLocalizationFailureEvidence,
  type ExportTitleLocalizationTransportInput,
} from '@/lib/cv-export-title-localization';

function experience(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp',
    position: 'Qxz',
    company: 'EmployerFixture',
    startDate: '2024-01',
    endDate: '',
    isPresent: true,
    description: 'x',
    originalUserDescription: 'x',
    canonicalDescription: 'x',
    descriptionOrigin: 'user',
    positionProvenance: 'manual',
    positionUserEdited: true,
    ...overrides,
  };
}

function fixture(exp: WorkExperience = experience()): CVData {
  return {
    id: 'title-observability-cv',
    name: 'Fixture',
    personal: {
      fullName: 'Fixture',
      email: '',
      phone: '',
      address: '',
      jobTitle: exp.position,
      gender: 'female',
    },
    summary: '',
    contentLocale: 'en',
    experience: [exp],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01',
    updatedAt: '2026-09-28',
    runtimeMigrationVersion: 3,
  };
}

function localizedResponse(input: ExportTitleLocalizationTransportInput, title = 'Gestionnaire logistique') {
  return {
    targetLocale: input.targetLocale,
    entries: input.entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle: title,
      facts: [],
    })),
  };
}

async function prepareSameLocale(
  cv: CVData,
  targetLocale: Locale,
  includePersonalTitle = false,
) {
  return prepareExportLocalizedTitles({
    sourceCv: cv,
    exportCv: structuredClone(cv),
    targetLocale,
    includePersonalTitle,
    adapter: async () => {
      throw new Error('provider_must_not_run');
    },
    getCurrentCv: () => cv,
  });
}

describe('stability title-localization observability', () => {
  it('records every existing Experience locale-resolution branch without changing precedence', async () => {
    const cases: Array<{
      expected: string;
      target: Locale;
      cv: CVData;
    }> = [
      {
        expected: 'direct_title_detection',
        target: 'en',
        cv: fixture(experience({
          position: 'Coordinates warehouse inventory and prepares records',
          positionSourceLocale: 'fr',
        })),
      },
      {
        expected: 'persisted_position_source_locale',
        target: 'en',
        cv: fixture(experience({ position: 'Qxz', positionSourceLocale: 'en' })),
      },
      {
        expected: 'authoritative_description_detection',
        target: 'es',
        cv: fixture(experience({
          position: 'Qxz',
          originalUserDescription: 'Gestiona pedidos y atiende a clientes diariamente.',
          canonicalDescription: '',
          description: 'x',
        })),
      },
      {
        expected: 'persisted_description_source_locale',
        target: 'fr',
        cv: fixture(experience({
          position: 'Qxz',
          descriptionSourceLocale: 'fr',
        })),
      },
      {
        expected: 'current_description_detection',
        target: 'en',
        cv: fixture(experience({
          position: 'Qxz',
          originalUserDescription: 'x',
          canonicalDescription: '',
          description: 'Coordinates customer service and prepares reports every day.',
        })),
      },
      {
        expected: 'content_locale',
        target: 'it',
        cv: { ...fixture(), contentLocale: 'it' },
      },
      {
        expected: 'target_locale_fallback',
        target: 'en',
        cv: { ...fixture(), contentLocale: undefined },
      },
    ];

    for (const testCase of cases) {
      const result = await prepareSameLocale(testCase.cv, testCase.target);
      expect(result.ok, testCase.expected).toBe(true);
      expect(result.diagnostics.titleLocaleResolutionByField['experience.exp.position'])
        .toMatchObject({
          resolutionSource: testCase.expected,
          finalSourceLocale: testCase.target,
          targetLocale: testCase.target,
        });
    }
  });

  it.each([
    ['matching_experience_inheritance', experience({ position: 'Qxz', positionSourceLocale: 'de' }), 'Qxz', 'de'],
    ['present_experience_inheritance', experience({ position: 'Other', positionSourceLocale: 'fr', isPresent: true }), 'Qxz', 'fr'],
    ['first_experience_inheritance', experience({ position: 'Other', positionSourceLocale: 'it', isPresent: false }), 'Qxz', 'it'],
  ] as const)(
    'records header branch %s and the inherited Experience branch',
    async (expected, exp, header, target) => {
      const cv = fixture(exp);
      cv.personal.jobTitle = header;
      cv.contentLocale = target;
      const result = await prepareSameLocale(cv, target, true);
      expect(result.ok).toBe(true);
      expect(result.diagnostics.titleLocaleResolutionByField['personal.jobTitle'])
        .toMatchObject({
          resolutionSource: expected,
          inheritedResolutionSource: 'persisted_position_source_locale',
          finalSourceLocale: target,
        });
    },
  );

  it('records one privacy-safe unit identity for two deduplicated title fields', async () => {
    const cv = fixture(experience({ position: 'Qxz', positionSourceLocale: 'en' }));
    cv.personal.jobTitle = 'Qxz';
    const result = await prepareExportLocalizedTitles({
      sourceCv: cv,
      exportCv: structuredClone(cv),
      targetLocale: 'fr',
      adapter: async (input) => localizedResponse(input),
      getCurrentCv: () => cv,
    });
    expect(result.ok).toBe(true);
    const header = result.diagnostics.titleIdentityByField['personal.jobTitle'];
    const entry = result.diagnostics.titleIdentityByField['experience.exp.position'];
    expect(result.diagnostics.titleFieldCount).toBe(2);
    expect(result.diagnostics.titleUniqueSourceCount).toBe(1);
    expect(header.diagnosticUnitId).toBe(entry.diagnosticUnitId);
    expect(header.sharedSourceTitleFieldCount).toBe(2);
    expect(header.fieldsShareSourceUnit).toBe(true);
    expect(result.diagnostics.titleProviderAttempts).toMatchObject([
      { pass: 'initial', attempted: true, result: 'success', unitCount: 1, batchDiagnosticId: 'b0' },
      { pass: 'repair', attempted: false, result: 'not_attempted', unitCount: 1, batchDiagnosticId: 'b0' },
    ]);
    const serialized = JSON.stringify(result.diagnostics);
    expect(serialized).not.toContain('Qxz');
    expect(serialized).not.toContain('EmployerFixture');
    expect(serialized).not.toContain('fnv1a_');
  });

  it.each([
    ['LF', 'Gestionnaire\nlogistique'],
    ['CR', 'Gestionnaire\rlogistique'],
    ['CRLF', 'Gestionnaire\r\nlogistique'],
  ] as const)('matches committed canonical %s semantics without changing acceptance', async (_label, title) => {
    const cv = fixture(experience({ positionSourceLocale: 'en' }));
    const result = await prepareExportLocalizedTitles({
      sourceCv: cv,
      exportCv: structuredClone(cv),
      targetLocale: 'fr',
      includePersonalTitle: false,
      adapter: async (input) => localizedResponse(input, title),
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.titleProviderRequestCount).toBe(1);
    expect(result.diagnostics.titleProviderRepairCount).toBe(0);
    expect(result.diagnostics.titleProviderAttempts).toMatchObject([
      {
        pass: 'initial',
        result: 'success',
        failureLayer: null,
        failureSubcode: null,
        batchDiagnosticId: 'b0',
      },
      {
        pass: 'repair',
        result: 'not_attempted',
        failureLayer: null,
        failureSubcode: null,
        batchDiagnosticId: 'b0',
      },
    ]);
  });

  it('retains initial server failure evidence separately from a successful repair', async () => {
    const cv = fixture(experience({ positionSourceLocale: 'en' }));
    let calls = 0;
    const result = await prepareExportLocalizedTitles({
      sourceCv: cv,
      exportCv: structuredClone(cv),
      targetLocale: 'fr',
      includePersonalTitle: false,
      adapter: async (input) => {
        calls += 1;
        if (calls === 1) {
          const error = new Error('export_title_localization_provider_malformed') as Error
            & ExportTitleLocalizationFailureEvidence;
          error.titleFailureLayer = 'server_translator_parse_or_parity';
          error.titleFailureSubcode = 'translator_target_locale_mismatch';
          error.titleHttpStatus = 422;
          error.titleExpectedIdentityCount = 1;
          error.titleReturnedIdentityCount = 1;
          error.titleIdentityParityPassed = true;
          error.titleCountParityPassed = true;
          throw error;
        }
        return localizedResponse(input);
      },
      getCurrentCv: () => cv,
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.titleProviderAttempts).toMatchObject([
      {
        pass: 'initial',
        result: 'failed',
        failureLayer: 'server_translator_parse_or_parity',
        failureSubcode: 'translator_target_locale_mismatch',
        httpStatus: 422,
      },
      {
        pass: 'repair',
        result: 'success',
        failureLayer: null,
        failureSubcode: null,
        httpStatus: 200,
      },
    ]);
    expect(result.diagnostics.titleInitialRepairUnitIdentityMatched).toBe(true);
  });

  it('retains both failed pass subcodes, terminal singleton truth, and not-reached employer truth', async () => {
    const cv = fixture(experience({ positionSourceLocale: 'en' }));
    let calls = 0;
    const result = await prepareExportLocalizedTitles({
      sourceCv: cv,
      exportCv: structuredClone(cv),
      targetLocale: 'fr',
      includePersonalTitle: false,
      adapter: async () => {
        calls += 1;
        const error = new Error('export_title_localization_provider_malformed') as Error
          & ExportTitleLocalizationFailureEvidence;
        error.titleFailureLayer = 'server_translator_parse_or_parity';
        error.titleFailureSubcode = calls === 1
          ? 'translator_response_not_object_or_invalid_json'
          : 'translator_missing_expected_identity';
        error.titleHttpStatus = 422;
        throw error;
      },
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.titleProviderAttempts.map((attempt) => attempt.failureSubcode))
      .toEqual([
        'translator_response_not_object_or_invalid_json',
        'translator_missing_expected_identity',
      ]);
    expect(result.diagnostics.titleTerminalBatchKind)
      .toBe('root_singleton_terminal_failure');
    expect(result.diagnostics.titleSingletonFailureCount).toBe(1);
    expect(result.diagnostics.employerIdentityStatus).toBe('not_reached');
    expect(result.diagnostics.employerIdentityPassed).toBeUndefined();
  });

  it('keeps an older server failure contract behavior-compatible when no subcode exists', async () => {
    const cv = fixture(experience({ positionSourceLocale: 'en' }));
    const result = await prepareExportLocalizedTitles({
      sourceCv: cv,
      exportCv: structuredClone(cv),
      targetLocale: 'fr',
      includePersonalTitle: false,
      adapter: async () => {
        throw new Error('export_title_localization_provider_malformed');
      },
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.reason)
      .toBe('export_title_localization_provider_malformed');
    expect(result.diagnostics.titleProviderAttempts).toHaveLength(2);
    expect(result.diagnostics.titleProviderAttempts.map((attempt) => attempt.failureSubcode))
      .toEqual(['diagnostic_unavailable_legacy', 'diagnostic_unavailable_legacy']);
  });

  it('maps every current client manifest predicate to a finite subcode', async () => {
    const cv = fixture(experience({ positionSourceLocale: 'en' }));
    const cases: Array<{
      expected: string;
      response: (input: ExportTitleLocalizationTransportInput) => ReturnType<typeof localizedResponse>;
    }> = [
      {
        expected: 'target_locale_mismatch',
        response: (input) => ({ ...localizedResponse(input), targetLocale: 'de' }),
      },
      {
        expected: 'entry_identity_count_mismatch',
        response: (input) => ({ ...localizedResponse(input), entries: [] }),
      },
      {
        expected: 'missing_expected_identity',
        response: (input) => ({
          ...localizedResponse(input),
          entries: [{ entryId: 'unexpected', localizedRoleTitle: 'Gestionnaire logistique', facts: [] }],
        }),
      },
      {
        expected: 'facts_not_array',
        response: (input) => {
          const response = localizedResponse(input);
          response.entries[0]!.facts = null as never;
          return response;
        },
      },
      {
        expected: 'facts_not_empty',
        response: (input) => {
          const response = localizedResponse(input);
          response.entries[0]!.facts = [{}] as never;
          return response;
        },
      },
      {
        expected: 'localized_title_empty',
        response: (input) => localizedResponse(input, '   '),
      },
      {
        expected: 'localized_title_too_long',
        response: (input) => localizedResponse(input, 'x'.repeat(501)),
      },
      {
        expected: 'unchanged_cross_locale_title',
        response: (input) => localizedResponse(input, 'Qxz'),
      },
    ];

    for (const testCase of cases) {
      const result = await prepareExportLocalizedTitles({
        sourceCv: cv,
        exportCv: structuredClone(cv),
        targetLocale: 'fr',
        includePersonalTitle: false,
        adapter: async (input) => testCase.response(input),
      });
      expect(result.ok, testCase.expected).toBe(false);
      expect(result.diagnostics.titleProviderAttempts[0]?.failureSubcode)
        .toBe(testCase.expected);
      expect(result.ok ? null : result.reason)
        .toBe('export_title_localization_provider_malformed');
    }

    expect(classifyExportLocalizedTitleFailure({
      sourceTitle: 'Software engineer',
      sourceLocale: 'en',
      targetLocale: 'ar',
      localizedTitle: 'Gestionnaire logistique',
    })).toBe('wrong_script');
    expect(classifyExportLocalizedTitleFailure({
      sourceTitle: 'Ingénieur logiciel',
      sourceLocale: 'fr',
      targetLocale: 'en',
      localizedTitle: 'Revisó la mercancía entrante en el almacén.',
    })).toBe('source_language_leakage');
    expect(classifyExportLocalizedTitleFailure({
      sourceTitle: 'SKU-ABC',
      sourceLocale: 'en',
      targetLocale: 'ar',
      localizedTitle: 'SKU-ABC',
    })).toBeNull();
  });

  it('reports actual employer evaluation separately from pre-projection failures', async () => {
    const cv = fixture(experience({ positionSourceLocale: 'en' }));
    const exportCv = structuredClone(cv);
    exportCv.experience.push(experience({ id: 'unexpected-export-entry', company: 'OtherFixture' }));
    const result = await prepareExportLocalizedTitles({
      sourceCv: cv,
      exportCv,
      targetLocale: 'en',
      includePersonalTitle: false,
      adapter: vi.fn(),
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.employerIdentityStatus).toBe('failed');
    expect(result.diagnostics.employerIdentityPassed).toBe(false);
  });

  it('uses execution-local batch IDs for split children without title-derived identity', async () => {
    const exp = experience({ position: 'Qxz', positionSourceLocale: 'en' });
    const cv = fixture(exp);
    cv.personal.jobTitle = 'Rzx';
    const result = await prepareExportLocalizedTitles({
      sourceCv: cv,
      exportCv: structuredClone(cv),
      targetLocale: 'fr',
      adapter: async () => {
        throw new Error('export_title_localization_provider_malformed');
      },
    });
    expect(result.ok).toBe(false);
    const attempts = result.diagnostics.titleProviderAttempts;
    expect(result.diagnostics.titleBatchSplitCount).toBe(1);
    expect(new Set(attempts.map((attempt) => attempt.batchDiagnosticId))).toEqual(
      new Set(['b0', 'b1']),
    );
    expect(attempts.filter((attempt) => attempt.pass === 'initial').map((attempt) => attempt.batchDiagnosticId))
      .toEqual(['b0', 'b1']);
    expect(attempts.filter((attempt) => attempt.pass === 'repair').map((attempt) => attempt.batchDiagnosticId))
      .toEqual(['b0', 'b1']);
    expect(JSON.stringify(result.diagnostics)).not.toContain('fnv1a_');
    expect(JSON.stringify(result.diagnostics)).not.toContain('Rzx');
    expect(JSON.stringify(result.diagnostics)).not.toContain('EmployerFixture');
  });

  it('keeps execution-local diagnostic IDs stable when the literal title changes', async () => {
    const run = async (title: string) => {
      const cv = fixture(experience({ position: title, positionSourceLocale: 'en' }));
      return prepareExportLocalizedTitles({
        sourceCv: cv,
        exportCv: structuredClone(cv),
        targetLocale: 'fr',
        includePersonalTitle: false,
        adapter: async (input) => localizedResponse(input),
      });
    };
    const first = await run('Qxz');
    const second = await run('Rzx');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.diagnostics.titleIdentityByField['experience.exp.position'].diagnosticUnitId)
      .toBe('u0');
    expect(second.diagnostics.titleIdentityByField['experience.exp.position'].diagnosticUnitId)
      .toBe('u0');
    expect(first.diagnostics.titleProviderAttempts[0]?.batchDiagnosticId)
      .toBe(second.diagnostics.titleProviderAttempts[0]?.batchDiagnosticId);
    expect(JSON.stringify(first.diagnostics)).not.toContain('Qxz');
    expect(JSON.stringify(second.diagnostics)).not.toContain('Rzx');
  });

  it('keeps renderer-stage truth, shared PDF/DOCX preparation, zero usage, and privacy wiring explicit', () => {
    const page = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    const diagnostics = readFileSync('src/lib/cv-export-diagnostics.ts', 'utf8');
    const title = readFileSync('src/lib/cv-export-title-localization.ts', 'utf8');
    expect(page.match(/const cvForExport = await prepareFinalLocaleSafeCv/g)).toHaveLength(3);
    expect(page).toContain('let rendererReached = false;');
    expect(page).toContain("stage: 'localize_export_titles'");
    expect(page).toContain('rendererReached,');
    expect(page).not.toContain('rendererReached: Boolean(prepared?.ok)');
    expect(diagnostics).toContain("| 'localize_export_titles'");
    expect(diagnostics).toContain('{ ...localization, usageDelta: 0 }');
    expect(title).not.toMatch(/increment(?:Ai)?Usage|commit(?:Ai)?Usage/iu);
    expect(title).not.toContain('provider output');
  });
});
