import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildExperienceSnapshotFromText,
  applyCanonicalExperienceEdit,
  inspectCanonicalSnapshotCoherence,
} from '@/lib/cv-canonical-snapshot';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import {
  classifyExportLocalizedTitleFailure,
  prepareExportLocalizedTitles,
} from '@/lib/cv-export-title-localization';
import { applyFinalizedBulletsToCv, type FinalizeCvAiFieldResult } from '@/lib/cv-ai-finalize-apply';
import {
  collectUnboundTitleLocaleFields,
  confirmTitleLocales,
  hashTitleLocaleText,
  resolveExperienceTitleLocale,
  resolvePersonalTitleLocale,
  TITLE_LOCALE_AUTHORITY_UNBOUND,
} from '@/lib/cv-title-locale-authority';

function experience(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp',
    position: 'Project Coordinator',
    company: 'Synthetic Organization',
    startDate: '2024-01',
    endDate: '',
    isPresent: true,
    description: 'Priprema planove i koordinira zadatke.',
    originalUserDescription: 'Priprema planove i koordinira zadatke.',
    canonicalDescription: 'Priprema planove i koordinira zadatke.',
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'sr',
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText('Priprema planove i koordinira zadatke.'),
    ...overrides,
  };
}

function cv(exp: WorkExperience = experience()): CVData {
  return {
    id: 'synthetic-title-authority',
    name: 'Synthetic',
    personal: {
      fullName: 'Synthetic',
      email: '',
      phone: '',
      address: '',
      jobTitle: exp.position,
      gender: 'male',
    },
    summary: '',
    contentLocale: 'sr',
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

describe('stability title locale authority: fail-closed correction', () => {
  it('keeps canonical entry sourceLocale bound to description, not the current title', () => {
    const entry = buildExperienceSnapshotFromText(experience({
      position: 'Project Coordinator',
      positionSourceLocale: 'en',
    }), 0);
    expect(entry.role).toBe('Project Coordinator');
    expect(entry.sourceLocale).toBe('sr');
  });

  it('does not treat canonicalState=valid alone as structural or semantic proof', () => {
    const source = cv();
    const entry = buildExperienceSnapshotFromText(source.experience[0]!, 0);
    const snapshot = {
      canonicalSummary: '',
      canonicalExperiences: [entry],
      canonicalLocale: 'sr' as const,
      canonicalRevision: 1,
      canonicalSourceHash: 'synthetic-unverified',
      canonicalCreatedFrom: 'user_structured_input' as const,
      canonicalState: 'valid' as const,
    };
    const coherence = inspectCanonicalSnapshotCoherence(source, snapshot);
    expect(coherence.structurallyPopulated).toBe(false);
    expect(coherence.structurallyValid).toBe(false);
    expect(coherence.semanticallyCoherent).toBe(false);
  });

  it('does not rebind a synthetic legacy title from matching canonical role and description locale', () => {
    const source = cv(experience({
      positionSourceLocale: 'en',
      positionProvenance: 'legacy_unknown',
    }));
    const entry = buildExperienceSnapshotFromText(source.experience[0]!, 0);
    const withSnapshot: CVData = {
      ...source,
      canonicalSnapshot: {
        canonicalSummary: '',
        canonicalExperiences: [entry],
        canonicalLocale: 'sr',
        canonicalRevision: 1,
        canonicalSourceHash: 'synthetic-unverified',
        canonicalCreatedFrom: 'user_structured_input',
        canonicalState: 'valid',
      },
    };
    const normalized = normalizeLegacyCvRuntime(withSnapshot);
    expect(entry.role).toBe(source.experience[0]?.position);
    expect(entry.sourceLocale).toBe('sr');
    expect(normalized.experience[0]?.positionSourceLocale).toBe('en');
  });

  it('never derives title locale from description locale for any provenance label', () => {
    const provenances: Array<WorkExperience['positionProvenance']> = [
      'manual', 'occupation_option', 'ai_generated',
      'localized_generated', 'legacy_unknown', undefined,
    ];
    for (const positionProvenance of provenances) {
      const source = cv(experience({ positionSourceLocale: 'en', positionProvenance }));
      const normalized = normalizeLegacyCvRuntime(source);
      expect(normalized.experience[0]?.positionSourceLocale).toBe('en');
    }
  });

  it('keeps hidden title ownership unproven from the observed generated-description fields', () => {
    const observed = {
      position: 'Synthetic Role',
      positionSourceLocale: 'en',
      descriptionOrigin: 'ai_generated' as const,
      generatedLocale: 'sr',
      generatedDescription: 'Priprema planove i koordinira zadatke.',
      originalUserDescription: undefined,
      canonicalDescription: undefined,
    };
    const manual = experience({ ...observed, positionProvenance: 'manual', positionUserEdited: true });
    const legacy = experience({ ...observed, positionProvenance: 'legacy_unknown', positionUserEdited: undefined });
    expect(manual.positionProvenance).not.toBe(legacy.positionProvenance);
    expect(manual.positionUserEdited).not.toBe(legacy.positionUserEdited);
    expect(manual.descriptionOrigin).toBe(legacy.descriptionOrigin);
    expect(manual.generatedLocale).toBe(legacy.generatedLocale);
    expect(manual.positionSourceLocale).toBe(legacy.positionSourceLocale);
  });

  it('keeps a legitimate same-locale explicit title on the zero-provider path', async () => {
    const source = cv(experience({
      position: 'Koordinator projekta',
      positionSourceLocale: 'sr',
      positionSourceLocaleTextHash: hashTitleLocaleText('Koordinator projekta'),
      positionProvenance: 'manual',
      positionUserEdited: true,
    }));
    const adapter = vi.fn(async () => { throw new Error('provider_must_not_run'); });
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'sr',
      includePersonalTitle: true,
      adapter,
    });
    expect(result.ok).toBe(true);
    expect(adapter).not.toHaveBeenCalled();
    expect(result.diagnostics.titleProviderRequestCount).toBe(0);
  });

  it('preserves SR-to-EN provider localization for an explicit title', async () => {
    const source = cv(experience({
      position: 'Koordinator projekta',
      positionSourceLocale: 'sr',
      positionSourceLocaleTextHash: hashTitleLocaleText('Koordinator projekta'),
      positionProvenance: 'manual',
      positionUserEdited: true,
    }));
    const adapter = vi.fn(async (input: { targetLocale: string; entries: Array<{ entryId: string }> }) => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({ entryId: entry.entryId, localizedRoleTitle: 'Project Coordinator', facts: [] })),
    }));
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'en',
      includePersonalTitle: true,
      adapter,
    });
    expect(result.ok).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('preserves EN-to-SR provider localization for an explicit title', async () => {
    const source = cv(experience({
      positionSourceLocale: 'en',
      positionSourceLocaleTextHash: hashTitleLocaleText('Project Coordinator'),
      positionProvenance: 'manual',
      positionUserEdited: true,
    }));
    const adapter = vi.fn(async (input: { targetLocale: string; entries: Array<{ entryId: string }> }) => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({ entryId: entry.entryId, localizedRoleTitle: 'Koordinator projekta', facts: [] })),
    }));
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'sr',
      includePersonalTitle: true,
      adapter,
    });
    expect(result.ok).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('invalidates stale locale authority atomically on a material manual title edit', () => {
    const before = cv(experience({
      positionSourceLocale: 'en', positionSourceKey: 'graphic_designer',
      positionProvenance: 'occupation_option', positionUserEdited: false,
    }));
    const after = applyCanonicalExperienceEdit(before, 'exp', 'position', 'Koordinator projekta', 'sr');
    expect(after.experience[0]).toMatchObject({
      position: 'Koordinator projekta',
      positionSourceLocale: undefined,
      positionSourceLocaleTextHash: undefined,
      positionSourceKey: undefined,
      positionProvenance: 'manual',
      positionUserEdited: true,
    });
  });

  it('advances app-localized title and locale authority atomically', () => {
    const source = cv(experience({
      position: 'Warehouse Worker',
      positionSourceLocale: 'en',
      positionProvenance: 'ai_generated',
      positionUserEdited: false,
    }));
    const finalized: FinalizeCvAiFieldResult = {
      blocked: false,
      text: 'Proverava robu i priprema porudžbine.',
      origin: 'ai_generated',
      roleDutyConflict: false,
      countedAsSuccess: true,
    };
    const after = applyFinalizedBulletsToCv(source, 'sr', 'exp', finalized);
    expect(after.experience[0]).toMatchObject({
      position: 'Radnik u magacinu',
      positionSourceLocale: 'sr',
      positionProvenance: 'localized_generated',
      positionUserEdited: false,
    });
  });

  it('retains unchanged-cross-locale-title rejection', () => {
    expect(classifyExportLocalizedTitleFailure({
      sourceTitle: 'Project Coordinator',
      sourceLocale: 'en',
      targetLocale: 'sr',
      localizedTitle: 'Project Coordinator',
    })).toBe('unchanged_cross_locale_title');
  });

  it('rejects unbound legacy metadata before any title provider request, even at the target locale', async () => {
    const source = cv(experience({ position: 'Qxz', positionSourceLocale: 'en' }));
    const adapter = vi.fn();
    const result = await prepareExportLocalizedTitles({
      sourceCv: source, exportCv: structuredClone(source), targetLocale: 'sr', adapter,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(TITLE_LOCALE_AUTHORITY_UNBOUND);
    expect(result.diagnostics.titleProviderRequestCount).toBe(0);
    expect(result.diagnostics.titleUnboundFieldKeys).toEqual(['experience.exp.position']);
    expect(result.diagnostics.titleProjectionPassed).toBe(false);
    expect(adapter).not.toHaveBeenCalled();
    expect(source.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
  });

  it('never trusts stale binding after the current title changes', () => {
    const exp = experience({
      position: 'Qxz', positionSourceLocale: 'en',
      positionSourceLocaleTextHash: hashTitleLocaleText('Old title'),
    });
    expect(resolveExperienceTitleLocale(exp)).toEqual({ locale: null, status: 'legacy_unbound' });
    expect(collectUnboundTitleLocaleFields(cv(exp)).map((field) => field.fieldKey))
      .toEqual(['experience.exp.position']);
  });

  it('treats a persisted occupation-option title without a matching binding as unbound', () => {
    const exp = experience({
      position: 'Qxz',
      positionProvenance: 'occupation_option',
      positionSourceKey: 'graphic_designer',
      positionUserEdited: false,
      positionSourceLocale: 'en',
    });
    const source = cv(exp);
    expect(resolveExperienceTitleLocale(exp)).toEqual({ locale: null, status: 'legacy_unbound' });
    const fields = collectUnboundTitleLocaleFields(source);
    expect(fields.map((field) => field.fieldKey)).toEqual(['experience.exp.position']);
    const confirmed = confirmTitleLocales(source, fields.map((field) => ({ ...field, locale: 'sr' })))!;
    expect(confirmed.experience[0]).toMatchObject({
      position: 'Qxz',
      positionSourceLocale: 'sr',
      positionSourceLocaleTextHash: hashTitleLocaleText('Qxz'),
      positionProvenance: 'occupation_option',
      positionSourceKey: 'graphic_designer',
      positionUserEdited: false,
    });
  });

  it('uses high-confidence direct detection without stamping legacy metadata', () => {
    const exp = experience({ position: 'Coordinates warehouse inventory and prepares records', positionSourceLocale: 'fr' });
    const source = cv(exp);
    const resolution = resolveExperienceTitleLocale(exp);
    expect(resolution.status).toBe('direct_detected');
    expect(resolution.locale).toBe('en');
    expect(collectUnboundTitleLocaleFields(source)).toEqual([]);
    expect(source.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
  });

  it('confirms the exact current title without changing text, provenance, or usage state', () => {
    const source = cv(experience({
      position: 'Qxz', positionSourceLocale: 'en',
      positionProvenance: 'ai_generated', positionUserEdited: false,
    }));
    const fields = collectUnboundTitleLocaleFields(source);
    const confirmed = confirmTitleLocales(source, fields.map((field) => ({ ...field, locale: 'sr' })))!;
    expect(confirmed.experience[0]?.position).toBe('Qxz');
    expect(confirmed.experience[0]?.positionProvenance).toBe('ai_generated');
    expect(confirmed.experience[0]?.positionUserEdited).toBe(false);
    expect(confirmed.experience[0]?.positionSourceLocale).toBe('sr');
    expect(confirmed.experience[0]?.positionSourceLocaleTextHash).toBe(hashTitleLocaleText('Qxz'));
    expect(confirmed.summary).toBe(source.summary);
    expect(confirmed.experience[0]?.description).toBe(source.experience[0]?.description);
    expect(resolvePersonalTitleLocale(confirmed).locale).toBe('sr');
    expect(collectUnboundTitleLocaleFields(structuredClone(confirmed))).toEqual([]);
    expect(source.experience[0]?.positionSourceLocale).toBe('en');
    expect((confirmed as CVData & { aiUsageCount?: number }).aiUsageCount).toBeUndefined();
  });

  it('moves a legacy matched header and Experience title from blocked to same-locale export', async () => {
    const source = cv(experience({ position: 'Qxz', positionSourceLocale: 'en' }));
    const adapter = vi.fn();
    const before = await prepareExportLocalizedTitles({
      sourceCv: source, exportCv: structuredClone(source), targetLocale: 'sr', adapter,
    });
    expect(before.ok).toBe(false);
    expect(before.diagnostics.titleProviderRequestCount).toBe(0);
    const fields = collectUnboundTitleLocaleFields(source);
    expect(fields).toHaveLength(1);
    const confirmed = confirmTitleLocales(source, [{ ...fields[0], locale: 'sr' }])!;
    const after = await prepareExportLocalizedTitles({
      sourceCv: confirmed, exportCv: structuredClone(confirmed), targetLocale: 'sr', adapter,
    });
    expect(after.ok).toBe(true);
    expect(after.diagnostics.titleProviderRequestCount).toBe(0);
    expect(after.diagnostics.titleProviderRepairCount).toBe(0);
    expect(after.diagnostics.titleProjectionPassed).toBe(true);
    expect(after.diagnostics.titleLocaleResolutionByField['personal.jobTitle'].resolutionSource)
      .toBe('matching_experience_inheritance');
    expect(adapter).not.toHaveBeenCalled();
  });

  it('confirms English through the same path and rejects changed-title races', () => {
    const source = cv(experience({ position: 'Qxz', positionSourceLocale: 'sr' }));
    const fields = collectUnboundTitleLocaleFields(source);
    const selections = fields.map((field) => ({ ...field, locale: 'en' as const }));
    expect(resolveExperienceTitleLocale(confirmTitleLocales(source, selections)!.experience[0]!).locale).toBe('en');
    expect(confirmTitleLocales({ ...source, experience: [{ ...source.experience[0], position: 'Abc' }] }, selections))
      .toBeNull();
  });

  it('requires independent choices for multiple ambiguous titles and standalone header', () => {
    const source = cv(experience({ position: 'Qxz', positionSourceLocale: 'en' }));
    source.experience.push(experience({ id: 'second', position: 'Zyx', positionSourceLocale: 'de' }));
    source.personal.jobTitle = 'Tuv';
    const fields = collectUnboundTitleLocaleFields(source);
    expect(fields.map((field) => field.fieldKey)).toEqual([
      'personal.jobTitle', 'experience.exp.position', 'experience.second.position',
    ]);
    expect(confirmTitleLocales(source, fields.slice(0, 2).map((field) => ({ ...field, locale: 'sr' }))))
      .toBeNull();
    const confirmed = confirmTitleLocales(source, fields.map((field, index) => ({
      ...field, locale: (['fr', 'sr', 'en'] as const)[index],
    })))!;
    expect(resolvePersonalTitleLocale(confirmed).locale).toBe('fr');
    expect(resolveExperienceTitleLocale(confirmed.experience[0]).locale).toBe('sr');
    expect(resolveExperienceTitleLocale(confirmed.experience[1]).locale).toBe('en');
  });

  it('invalidates a previously bound locale after a material manual title edit', () => {
    const source = cv(experience({
      position: 'Qxz', positionSourceLocale: 'en',
      positionSourceLocaleTextHash: hashTitleLocaleText('Qxz'),
    }));
    const edited = applyCanonicalExperienceEdit(source, 'exp', 'position', 'Zyx', 'sr');
    expect(edited.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
    expect(resolveExperienceTitleLocale(edited.experience[0]).locale).toBeNull();
    expect(edited.experience[0]?.positionSourceLocaleTextHash)
      .not.toBe(source.experience[0]?.positionSourceLocaleTextHash);
  });

  it('keeps explicit bound same-locale titles out of provider and reports no hash in diagnostics', async () => {
    const source = cv(experience({
      position: 'Qxz', positionSourceLocale: 'sr',
      positionSourceLocaleTextHash: hashTitleLocaleText('Qxz'),
    }));
    const adapter = vi.fn();
    const result = await prepareExportLocalizedTitles({
      sourceCv: source, exportCv: structuredClone(source), targetLocale: 'sr', adapter,
    });
    expect(result.ok).toBe(true);
    expect(adapter).not.toHaveBeenCalled();
    expect(result.diagnostics.titleLocaleBindingStatusByField['experience.exp.position']).toBe('bound');
    expect(JSON.stringify(result.diagnostics)).not.toContain(hashTitleLocaleText('Qxz'));
  });

  it('keeps an invariant acronym on a zero-provider path without claiming a language', async () => {
    const source = cv(experience({ position: 'IBM', positionSourceLocale: 'en' }));
    const adapter = vi.fn();
    expect(collectUnboundTitleLocaleFields(source)).toEqual([]);
    const result = await prepareExportLocalizedTitles({
      sourceCv: source, exportCv: structuredClone(source), targetLocale: 'sr', adapter,
    });
    expect(result.ok).toBe(true);
    expect(adapter).not.toHaveBeenCalled();
    expect(result.diagnostics.titleLocaleBindingStatusByField['experience.exp.position']).toBe('invariant');
    expect(source.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
  });

  it('preserves generated-from-empty app-owned title authority on a same-locale export', async () => {
    const source = cv(experience({
      position: 'Warehouse Worker', positionSourceLocale: 'en',
      positionProvenance: 'ai_generated', positionUserEdited: false,
      description: '', originalUserDescription: '', canonicalDescription: '',
    }));
    const finalized: FinalizeCvAiFieldResult = {
      blocked: false, text: 'Proverava robu i priprema porudžbine.',
      origin: 'ai_generated', roleDutyConflict: false, countedAsSuccess: true,
    };
    const applied = applyFinalizedBulletsToCv(source, 'sr', 'exp', finalized);
    expect(applied.experience[0]?.positionSourceLocaleTextHash)
      .toBe(hashTitleLocaleText(applied.experience[0]?.position || ''));
    const adapter = vi.fn();
    const result = await prepareExportLocalizedTitles({
      sourceCv: applied, exportCv: structuredClone(applied), targetLocale: 'sr',
      includePersonalTitle: false, adapter,
    });
    expect(result.ok).toBe(true);
    expect(adapter).not.toHaveBeenCalled();
  });

  it('uses one pre-provider title authority gate for both PDF and DOCX export handlers', () => {
    const page = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    const prepare = page.indexOf('const prepareFinalLocaleSafeCv = async');
    const collect = page.indexOf('collectUnboundTitleLocaleFields(sourceCv)', prepare);
    const experienceProvider = page.indexOf('prepareExperienceLocalizedSurfaces({', prepare);
    const titleProvider = page.indexOf('prepareExportLocalizedTitles({', prepare);
    expect(prepare).toBeGreaterThan(0);
    expect(collect).toBeGreaterThan(prepare);
    expect(experienceProvider).toBeGreaterThan(collect);
    expect(titleProvider).toBeGreaterThan(experienceProvider);
    expect(page.match(/await prepareFinalLocaleSafeCv\(/g)).toHaveLength(3);
    expect(page).toContain('persistCurrentCvTransactionally(next)');
    expect(page).toContain('t.titleLocaleConfirmation.dialogTitle');
  });
});
