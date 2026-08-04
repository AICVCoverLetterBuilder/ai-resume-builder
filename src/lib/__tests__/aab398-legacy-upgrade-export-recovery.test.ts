/**
 * @vitest-environment jsdom
 *
 * AAB-398: a version-3 Android draft may already contain explicit user-origin
 * and canonical evidence while lacking the newer export grounding marker.
 */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { buildCanonicalSnapshotFromCv } from '@/lib/cv-canonical-snapshot';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  hashUserOriginSourceClause,
  recoverSemanticDutiesFromUserOrigin,
} from '@/lib/cv-semantic-duty-facts';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import {
  buildAndStoreCvExportDiagnostic,
  clearCvExportDiagnosticsForTests,
  resolveCvExportToastMappingKey,
} from '@/lib/cv-export-diagnostics';
import { formatCvExportIntegrityToast } from '@/lib/cv-export-error-message';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';

const REF = '2026-08-04';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FIRST_DUTIES = [
  'Atiendo solicitudes recibidas por los canales asignados.',
  'Ordeno expedientes según la fecha de recepción.',
  'Aviso a las personas cuando cambia el estado del trámite.',
];
const SECOND_DUTIES = [
  'Comparo los datos escritos con los documentos entregados.',
  'Anoto las incidencias encontradas durante la revisión.',
  'Archivo cada expediente en la ubicación indicada.',
];

let fetchUrls: string[] = [];

function experience(id: string, duties: string[], dates: { start: string; end: string; present: boolean }): WorkExperience {
  const description = duties.map((duty) => `- ${duty}`).join('\n');
  return {
    id,
    company: id === 'exp-current' ? 'Centro Norte' : 'Oficina Sur',
    position: 'Coordinador de servicios',
    startDate: dates.start,
    endDate: dates.end,
    isPresent: dates.present,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    // Device shape: no generatedDescription/generatedLocale/recovery marker.
  };
}

function legacyUpgradeCv(): CVData {
  const base: CVData = {
    id: 'aab398-device-upgrade',
    name: 'CV conservado',
    templateId: 'modern-minimal',
    region: 'EU',
    personal: {
      fullName: 'Persona de prueba',
      email: 'device@example.test',
      phone: '+381 60 000 000',
      address: 'Belgrado',
      jobTitle: 'Coordinador de servicios',
      photoEnabled: false,
    },
    summary: 'Profesional de coordinación de servicios con aproximadamente seis años de experiencia. Atiende solicitudes, ordena expedientes y mantiene informadas a las personas sobre cada trámite.',
    summaryOrigin: 'deterministic_fallback',
    canonicalSummary: 'Profesional de coordinación de servicios con aproximadamente seis años de experiencia. Atiende solicitudes, ordena expedientes y mantiene informadas a las personas sobre cada trámite.',
    contentLocale: 'es',
    experience: [
      experience('exp-current', FIRST_DUTIES, { start: '2023-08', end: '', present: true }),
      experience('exp-prior', SECOND_DUTIES, { start: '2020-08', end: '2023-07', present: false }),
    ],
    education: [],
    skills: ['Organización', 'Comunicación'],
    certifications: [],
    languages: [{ name: 'Español', level: 'native' }],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    runtimeMigrationVersion: 3,
  };
  return {
    ...base,
    canonicalSnapshot: buildCanonicalSnapshotFromCv(base, {
      canonicalLocale: 'es',
      createdFrom: 'legacy_migration',
      revision: 1,
      state: 'valid',
    }),
  };
}

function expectClosed(cv: CVData, reason: RegExp): void {
  const prepared = prepareExportReadyCv(cv, 'es', 'modern-minimal', {
    referenceDate: REF,
  });
  expect(prepared.ok).toBe(false);
  if (!prepared.ok) expect(prepared.reason).toMatch(reason);
}

function mockDownload(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://aab398/${blobs.length}`;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
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
    const url = String(input);
    fetchUrls.push(url);
    const fileName = url.split('/').pop() || '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) return new Response(fs.readFileSync(fontPath), { status: 200 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
});

beforeEach(() => {
  localStorage.clear();
  clearCvExportDiagnosticsForTests();
  fetchUrls = [];
});

describe('AAB-398 legacy user-origin export recovery', () => {
  it('recovers exactly three source-traced duties per legacy entry', () => {
    const raw = legacyUpgradeCv();
    for (const exp of raw.experience) {
      const grounding = recoverSemanticDutiesFromUserOrigin(exp, raw.canonicalSnapshot);
      const sourceClauses = splitExperienceBullets(exp.originalUserDescription || '');
      expect(grounding.source).toBe('user_origin_recovered');
      expect(grounding.duties).toHaveLength(3);
      expect(grounding.duties.map((duty) => duty.sourceClause)).toEqual(sourceClauses);
      expect(grounding.duties.map((duty) => duty.sourceClauseHash)).toEqual(
        sourceClauses.map(hashUserOriginSourceClause),
      );
      expect(grounding.duties.every((duty) => duty.confidence === 'exact_user_origin')).toBe(true);
      expect(grounding.duties.every((duty) => duty.key.startsWith('user_origin_clause_'))).toBe(true);
      expect(grounding.duties.every((duty) => Boolean(duty.sourceFactId))).toBe(true);
    }
  });

  it('prepares one unchanged export-ready snapshot and produces PDF and DOCX blobs', async () => {
    const raw = legacyUpgradeCv();
    const persistedBefore = structuredClone(raw);
    const visibleBefore = raw.experience.map((exp) => exp.description);
    const usageBefore = localStorage.getItem('cvpro-ai-usage');
    const prepared = prepareExportReadyCv(raw, 'es', 'modern-minimal', {
      referenceDate: REF,
    });
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.diagnostics.experienceProvenance.map((row) => row.source))
      .toEqual(['user_origin_recovered', 'user_origin_recovered']);
    expect(prepared.diagnostics.experienceProvenance.map((row) => row.groundingBulletCount))
      .toEqual([3, 3]);
    expect(prepared.cv.experience.map((exp) => exp.description)).toEqual(visibleBefore);
    expect(raw).toEqual(persistedBefore);

    const pdfBlob = await buildModernMinimalPdfBlob(prepared.cv, 'es');
    expect(pdfBlob.size).toBeGreaterThan(0);
    expect(pdfBlob.type).toBe('application/pdf');

    const savedBlobs = mockDownload();
    const docxResult = await exportToDOCX(prepared.cv, 'aab398-device-upgrade', 'es', 'modern-minimal');
    expect(docxResult.result).toBe('saved');
    const docxBlob = savedBlobs.at(-1);
    expect(docxBlob?.size).toBeGreaterThan(0);
    expect(docxBlob?.type).toBe(DOCX_MIME);

    const pdfTrace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'es', rawCv: raw, prepared,
      rendererReached: true, blobProduced: true,
      blobSize: pdfBlob.size, blobMimeType: pdfBlob.type,
    });
    const docxTrace = buildAndStoreCvExportDiagnostic({
      format: 'docx', locale: 'es', rawCv: raw, prepared,
      rendererReached: true, blobProduced: true,
      blobSize: docxBlob?.size, blobMimeType: docxBlob?.type,
    });
    expect(pdfTrace.exportReadySnapshotId).toBe(docxTrace.exportReadySnapshotId);
    expect(pdfTrace.rendererReached && docxTrace.rendererReached).toBe(true);
    expect(pdfTrace.blobProduced && docxTrace.blobProduced).toBe(true);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(usageBefore);
    expect(fetchUrls.filter((url) => /anthropic|\/api\/(?:generate|improve|translate)/i.test(url))).toEqual([]);
  }, 60_000);

  it('fails closed when explicit user origin lacks the original source', () => {
    const raw = legacyUpgradeCv();
    raw.experience = [{ ...raw.experience[0], originalUserDescription: '' }];
    raw.canonicalSnapshot = undefined;
    expectClosed(raw, /legacy_user_origin_recovery_insufficient_source|legacy_export_recovery_no_safe_duties/);
  });

  it.each(['ai_generated', undefined] as const)(
    'does not grant manual trust to %s origin',
    (origin) => {
      const raw = legacyUpgradeCv();
      raw.experience = [{ ...raw.experience[0], descriptionOrigin: origin }];
      raw.canonicalSnapshot = undefined;
      expectClosed(raw, /legacy_export_recovery_no_safe_duties|summary_fact_set_missing_recovered_duties/);
    },
  );

  it('fails closed on a malformed canonical snapshot', () => {
    const raw = legacyUpgradeCv();
    raw.canonicalSnapshot = {
      ...raw.canonicalSnapshot!,
      canonicalExperiences: raw.canonicalSnapshot!.canonicalExperiences.map((entry, index) => (
        index === 0 ? { ...entry, bullets: entry.bullets.slice(0, 2) } : entry
      )),
    };
    expectClosed(raw, /legacy_user_origin_recovery_malformed_snapshot/);
  });

  it('keeps valid modern catalogue-grounded entries unchanged', () => {
    const raw = legacyUpgradeCv();
    const duties = [
      'Prepare dishes according to restaurant standards.',
      'Maintain workplace hygiene.',
      'Collaborate with the kitchen team.',
    ].map((duty) => `- ${duty}`).join('\n');
    raw.experience = [{
      ...raw.experience[0],
      position: 'Baker',
      description: duties,
      originalUserDescription: duties,
      canonicalDescription: duties,
    }];
    raw.canonicalSnapshot = undefined;
    raw.summary = 'Experienced baker who prepares dishes, maintains workplace hygiene, and collaborates with the kitchen team.';
    raw.canonicalSummary = raw.summary;
    raw.contentLocale = 'en';
    const prepared = prepareExportReadyCv(raw, 'en', 'modern-minimal', { referenceDate: REF });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.experience[0].description).toBe(duties);
    expect(prepared.diagnostics.experienceProvenance[0].source).toBe('modern_provenance');
  });

  it('routes Experience recovery separately while retaining the Summary message', () => {
    expect(resolveCvExportToastMappingKey('legacy_export_recovery_no_safe_duties', 'pdf'))
      .toBe('EXPERIENCE_FACTS_REVIEW');
    const experienceEs = formatCvExportIntegrityToast(
      { reason: 'legacy_export_recovery_no_safe_duties' }, 'es', 'pdf',
    );
    expect(experienceEs).toMatch(/experiencia|experiencias/i);
    expect(experienceEs).not.toMatch(/resumen/i);

    expect(resolveCvExportToastMappingKey('summary_validation_failed_after_recovery', 'docx'))
      .toBe('SUMMARY_FACTS_REVIEW');
    expect(formatCvExportIntegrityToast(
      { reason: 'summary_validation_failed_after_recovery' }, 'es', 'docx',
    )).toMatch(/resumen/i);
  });
});
