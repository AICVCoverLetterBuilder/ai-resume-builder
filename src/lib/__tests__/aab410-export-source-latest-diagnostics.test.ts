// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CVData } from '@/lib/types';
import {
  CV_EXPORT_SOURCE_AUTHORITY_REVISION,
  resolveCvExportSourceAuthority,
} from '@/lib/cv-export-source-authority';
import {
  CV_EXPORT_LATEST_DIAGNOSTIC_REVISION,
  resolveLatestCvExportDiagnosticFormat,
} from '@/lib/cv-export-diagnostics';

function normalizeSourceLineEndings(source: string): string {
  return source.replace(/\r\n/gu, '\n');
}

function lineEndingFixtures(source: string): [string, string] {
  const lf = normalizeSourceLineEndings(source);
  return [lf, lf.replace(/\n/gu, '\r\n')];
}

function expectTransactionalSummaryAuthority(
  pageSource: string,
  helperSource: string,
): void {
  const page = normalizeSourceLineEndings(pageSource);
  const helper = normalizeSourceLineEndings(helperSource);

  expect(page).toContain(
    'summary-cvref-single-writer-411-v1',
  );

  expect(page).toContain(
    'syncCvRefFromReactState({',
  );

  expect(page).not.toMatch(
    /useEffect\(\(\) => \{\s*cvRef\.current = cv;\s*\}, \[cv\]\);/u,
  );

  expect(page).not.toContain(
    'hashSummaryTextForApply(cvRef.current.summary) === ownership.authoritativeSummaryHash',
  );

  expect(helper).toContain(
    'summary-cvref-react-sync-411-v1',
  );

  expect(helper).toContain(
    'authoritativeSummaryHash',
  );

  expect(helper).toContain(
    'options.currentSummaryHash === authoritativeHash',
  );

  expect(helper).toContain(
    'options.nextSummaryHash !== authoritativeHash',
  );

  expect(helper).toContain(
    "reason:\n        'authoritative_summary_hash_mismatch'",
  );

  expect(helper).toContain(
    'options.cvRef.current = options.nextCv',
  );
}

const SHORTER_SUMMARY =
  'Tengo unos tres años y medio de experiencia. Actualmente soy Coordinador de servicio de bicicletas eléctricas y recepción de clientes en RadWerk, donde coordino las citas de mantenimiento de bicicletas eléctricas y reviso las bicicletas entrantes y documento los problemas técnicos y explico a los clientes los pasos de reparación necesarios. Antes fui Empleado de recepción de huéspedes y gestión de reservas en StadtHotel, donde recibí a los huéspedes en la recepción y gestioné las reservas y los cambios necesarios y atendí consultas por teléfono y correo electrónico.';

const STALE_SUMMARY =
  'professional con alrededor de tres años y medio de experiencia.';

function cvWithSummary(summary: string): CVData {
  return {
    id: 'aab410-export-authority',
    name: 'AAB 410',
    personal: {
      fullName: 'John wayn',
      email: '',
      phone: '',
      address: '',
      jobTitle:
        'Coordinador de servicio de bicicletas eléctricas y recepción de clientes',
      gender: 'male',
      photoEnabled: false,
    },
    summary,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
  } as CVData;
}

function store(
  format: 'pdf' | 'docx',
  capturedAt: string,
): void {
  localStorage.setItem(
    format === 'pdf'
      ? 'cvpro-export-diag-pdf'
      : 'cvpro-export-diag-docx',
    JSON.stringify({
      capturedAt,
      exportFormat: format,
    }),
  );
}

describe(
  'AAB-410 export source authority and latest diagnostics',
  () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it(
      'keeps the live Shorter Summary and only overrides templateId',
      () => {
        const live = cvWithSummary(SHORTER_SUMMARY);
        const staleReact = cvWithSummary(STALE_SUMMARY);

        const source = resolveCvExportSourceAuthority(
          live,
          'clean-simple',
        );

        expect(source.summary).toBe(SHORTER_SUMMARY);
        expect(source.summary).not.toBe(staleReact.summary);
        expect(source.summary).toContain('RadWerk');
        expect(source.summary).toContain('StadtHotel');
        expect(source.templateId).toBe('clean-simple');

        expect(live.summary).toBe(SHORTER_SUMMARY);
        expect(live.templateId).toBe('modern-minimal');

        expect(CV_EXPORT_SOURCE_AUTHORITY_REVISION)
          .toBe('cv-export-source-authority-410-v1');
      },
    );

    it(
      'selects whichever stored PDF/DOCX diagnostic was captured last',
      () => {
        expect(resolveLatestCvExportDiagnosticFormat())
          .toBeNull();

        store('pdf', '2026-08-09T07:24:13.914Z');
        store('docx', '2026-08-09T07:30:00.000Z');

        expect(resolveLatestCvExportDiagnosticFormat())
          .toBe('docx');

        store('pdf', '2026-08-09T07:31:00.000Z');

        expect(resolveLatestCvExportDiagnosticFormat())
          .toBe('pdf');

        store('docx', '2026-08-09T07:32:00.000Z');

        expect(resolveLatestCvExportDiagnosticFormat())
          .toBe('docx');

        expect(CV_EXPORT_LATEST_DIAGNOSTIC_REVISION)
          .toBe('cv-export-latest-diagnostic-410-v1');
      },
    );

    it(
      'uses the shared authority in both PDF and DOCX and has no stale overlay',
      () => {
        const page = readFileSync(
          'src/app/cv-builder/page.tsx',
          'utf8',
        );

        expect(page).not.toMatch(
          /\.\.\.cvRef\.current,\s*\.\.\.cv,\s*templateId:\s*selectedTemplateId/u,
        );

        const calls =
          page.match(
            /resolveCvExportSourceAuthority\(\s*cvRef\.current,\s*selectedTemplateId,\s*\)/gu,
          ) || [];

        expect(calls).toHaveLength(2);

        // Generic use-sites remain. Behavior is fixed centrally.
        expect(page).toContain(
          '<CvExportCopyDiagnosticsButton />',
        );
      },
    );

    it(
      'binds the generic diagnostics component to the newest stored format',
      () => {
        const controls = readFileSync(
          'src/components/CvExportDiagnosticsControls.tsx',
          'utf8',
        );

        let start = controls.indexOf(
          'export function CvExportCopyDiagnosticsButton',
        );

        if (start < 0) {
          start = controls.indexOf(
            'export const CvExportCopyDiagnosticsButton',
          );
        }

        expect(start).toBeGreaterThanOrEqual(0);

        const nextExport = controls.indexOf(
          '\nexport ',
          start + 1,
        );

        const component = controls.slice(
          start,
          nextExport >= 0 ? nextExport : controls.length,
        );

        expect(component).toContain(
          'copyLatestCvExportDiagnosticsToClipboard()',
        );

        expect(component).not.toContain(
          'copyCvExportDiagnosticsToClipboard(',
        );
      },
    );
  },
);


describe('AAB-411 device-equivalent Summary ownership regression', () => {
  it('keeps the transactional Summary authoritative through the shared cvRef sync boundary', () => {
    const pageSource = readFileSync(
      'src/app/cv-builder/page.tsx',
      'utf8',
    );

    const helperSource = readFileSync(
      'src/lib/cv-summary-cvref-react-sync.ts',
      'utf8',
    );

    const pageFixtures = lineEndingFixtures(pageSource);
    const helperFixtures = lineEndingFixtures(helperSource);

    for (const index of [0, 1] as const) {
      expectTransactionalSummaryAuthority(
        pageFixtures[index],
        helperFixtures[index],
      );
    }
  });

  it('blocks the exact stale 63-char AAB-410 Summary from Spanish stale-metadata rebound', () => {
    const authority = readFileSync(
      'src/lib/cv-summary-current-text-authority.ts',
      'utf8',
    );

    const prepare = readFileSync(
      'src/lib/prepare-export-ready-cv.ts',
      'utf8',
    );

    expect(authority).toContain(
      'summary-stale-rebound-locale-guard-411-v1',
    );

    expect(authority).toContain(
      'foreign_professional_prefix_non_english_target',
    );

    expect(prepare).toContain(
      "visibleText: cv.summary || ''",
    );

    expect(prepare).toContain(
      'requestedLocale',
    );
  });
});
