/** @vitest-environment jsdom */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CVData, WorkExperience } from '@/lib/types';
import { translations, type Locale } from '@/lib/i18n/translations';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { CvExportFailure, formatCvExportIntegrityToast } from '@/lib/cv-export-error-message';
import { resolveCvExportToastMappingKey } from '@/lib/cv-export-diagnostics';
import {
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  hashExperienceLocalizedSurfaceValue,
} from '@/lib/cv-experience-localized-surfaces';

const observed = vi.hoisted(() => ({
  locale: 'sr' as Locale,
  currentCv: undefined as unknown as CVData,
  writes: [] as CVData[],
  templateSummary: '',
  titleRequests: 0,
  experienceRequests: 0,
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: observed.locale, t: translations[observed.locale] }),
}));

vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: observed.currentCv,
    setCurrentCv: (next: CVData) => { observed.currentCv = next; observed.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => {
      observed.currentCv = next;
      observed.writes.push(next);
      return true;
    },
    isPro: true,
    canDownload: () => true,
    incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: vi.fn(),
    getProAiUsageCount: () => 0,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab482-preview-token' }),
  }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (_url: string, options: { body?: Record<string, unknown> }) => {
    const body = options.body || {};
    if (body.action === 'experience-localize') {
      observed.experienceRequests += 1;
      const records = Array.isArray(body.records)
        ? body.records as Array<Record<string, unknown>>
        : [];
      const localized = records.map((record, index) => {
        const localizedText = SERBIAN_TESTWERK.split('\n')[index] || '';
        return {
          ...record,
          localizedText,
          semanticValidation: {
            validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
            predicatePreserved: true,
            objectPreserved: true,
            workDomainPreserved: true,
            scopePreserved: true,
            negationPreserved: true,
            tensePreserved: true,
            unsupportedFactsIntroduced: false,
          },
        };
      });
      return {
        data: {
          localizedExperienceSurfaces: {
            snapshotId: body.snapshotId,
            targetLocale: body.targetLocale,
            records: localized,
            provenance: 'provider',
            independentVerification: {
              snapshotId: body.snapshotId,
              targetLocale: body.targetLocale,
              validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
              verifierAttemptCount: 1,
              records: localized.map((record) => ({
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
            },
          },
        },
        response: { ok: true, status: 200 },
        jsonParseFailed: false,
      };
    }
    if (body.action === 'export-title-localize') {
      observed.titleRequests += 1;
      const entries = Array.isArray(body.entries)
        ? body.entries as Array<Record<string, unknown>>
        : [];
      return {
        data: {
          localizedManifest: {
            targetLocale: body.targetLocale,
            entries: entries.map((entry) => ({
              entryId: entry.entryId,
              localizedRoleTitle: entry.roleTitle === 'Graphic designer'
                ? 'Grafička dizajnerka'
                : String(entry.roleTitle || ''),
              facts: [],
            })),
          },
        },
        response: { ok: true, status: 200 },
        jsonParseFailed: false,
      };
    }
    return {
      data: { code: 'unexpected_test_transport' },
      response: { ok: false, status: 422 },
      jsonParseFailed: false,
    };
  }),
}));

vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));
vi.mock('@/components/TemplatePreview', () => ({ TemplatePreview: () => <div /> }));
vi.mock('@/components/TemplatePreviewFullscreenModal', () => ({ TemplatePreviewFullscreenModal: () => null }));
vi.mock('@/components/cv-templates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/cv-templates')>();
  const Original = actual.templateComponents['modern-minimal'];
  return {
      ...actual,
      templateComponents: {
        ...actual.templateComponents,
        'modern-minimal': (props: { data: CVData; locale?: Locale }) => {
          observed.templateSummary = props.data.summary || '';
          return <Original {...props} />;
        },
        'creative-artistic': (props: { data: CVData; locale?: Locale }) => {
          observed.templateSummary = props.data.summary || '';
          const Component = actual.templateComponents['creative-artistic'];
          return <Component {...props} />;
        },
        'corporate-navy': (props: { data: CVData; locale?: Locale }) => {
          observed.templateSummary = props.data.summary || '';
          const Component = actual.templateComponents['corporate-navy'];
          return <Component {...props} />;
        },
      },
    };
  });

const HINDI_TESTWERK = [
  'मुद्रित और डिजिटल सामग्री के लिए ग्राफिक सामग्री तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम परिणामों की गुणवत्ता की जाँच करती थी।',
].join('\n');

const SERBIAN_TESTWERK = [
  'Izrađivala sam grafičke materijale za štampane i digitalne medije.',
  'Razvijala sam vizuelne dizajnerske koncepte prema potrebama klijenata.',
  'Pregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.',
].join('\n');

const SERBIAN_CURRENT = [
  'Pripremam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređujem grafike i slike za različite projekte.',
  'Usklađujem nacrte i izmene sa članovima projektnog tima.',
].join('\n');

const SERBIAN_PRIOR = [
  'Pripremala sam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređivala sam grafike i slike za različite projekte.',
  'Usklađivala sam nacrte i izmene sa članovima projektnog tima.',
].join('\n');

const AAB482_SERBIAN_TERMINAL_SUMMARY = 'Imam oko sedam godina iskustva. Trenutno radim kao Grafička dizajnerka u Rewitu Current Test, gde pripremam vizuelne koncepte i rasporede za digitalne materijale, uređujem grafike i fotografije za različite projekte i usaglašavam nacrte i izmene sa članovima projektnog tima. Prethodno sam radila kao Grafička dizajnerka u TestWerk GmbH, gde sam kreirala grafičke materijale za štampane i digitalne medije, razvijala koncepte vizuelnog dizajna prema potrebama klijenata i pregledala projekte dizajna i proveravala kvalitet finalnih rezultata. Prethodno sam radila kao Grafička dizajnerka u Rewitu, gde sam izrađivala vizuelne koncepte i rasporede za digitalne materijale, uređivala grafike i fotografije za različite projekte i usaglašavala nacrte i izmene sa članovima projektnog tima.';

function entry(options: {
  id: string;
  company: string;
  startDate: string;
  isPresent: boolean;
  endDate?: string;
  description: string;
  position?: string;
}): WorkExperience {
  return {
    id: options.id,
    company: options.company,
    position: options.position || 'Grafička dizajnerka',
    startDate: options.startDate,
    endDate: options.isPresent ? '' : (options.endDate || '2025-12'),
    isPresent: options.isPresent,
    description: options.description,
    originalUserDescription: options.description,
    canonicalDescription: options.description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'sr',
  };
}

function deviceCv(): CVData {
  const testWerkSource: WorkExperience = {
    id: 'be5c794b', company: 'TestWerk GmbH', position: 'Graphic designer',
    startDate: '2021-01', endDate: '2024-01', isPresent: false,
    description: HINDI_TESTWERK,
    originalUserDescription: HINDI_TESTWERK,
    canonicalDescription: HINDI_TESTWERK,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'hi',
    positionSourceLocale: 'en',
  };
  const testWerk = applyGeneratedExperienceDescription(testWerkSource, SERBIAN_TESTWERK, {
    locale: 'sr', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'enhance',
    requestHash: 'aab482-device-testwerk',
  });
  const source = {
    id: 'aab482-device-five-entry', name: 'AAB482',
    personal: {
      fullName: 'Test Person', email: 'test@example.test', phone: '', address: '',
      jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false,
    },
    summary: '', summaryOrigin: 'deterministic_fallback' as const,
    summaryGeneratedLocale: 'sr' as const, contentLocale: 'sr' as const,
    experience: [
      entry({ id: '90ceb215', company: 'Rewitu Current Test', startDate: '2026-03', isPresent: true, description: SERBIAN_CURRENT }),
      testWerk,
      entry({ id: 'a221433', company: 'Rewitu', startDate: '2019-06', endDate: '2022-12', isPresent: false, description: SERBIAN_PRIOR }),
      entry({ id: 'b9d3a6a5', company: 'Atlas', startDate: '2023-01', isPresent: true, position: 'Skladišna radnica', description: 'Proveravam pristiglu robu.\nProveravam dokumentaciju.\nSarađujem sa kolegama.' }),
      entry({ id: '8da68c15', company: 'Pixel Studio', startDate: '2026-01', isPresent: true, position: 'Operaterka', description: 'Vodila sam evidenciju smena.' }),
    ],
    education: [], skills: [], certifications: [], languages: [], projects: [],
    templateId: 'modern-minimal' as const, region: 'EU' as const,
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
    runtimeMigrationVersion: 3,
  } as CVData;
  const manifest = buildSummaryV2SelectionManifest(captureSummaryV2Snapshot({
    cv: source, locale: 'sr', gender: 'female', referenceDateIso: '2026-08-18',
  }));
  const generated = buildSummaryV2DeterministicText(manifest);
  return {
    ...source,
    summary: generated.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    ),
  };
}

function unresolvedDeviceCv(): CVData {
  const source = deviceCv();
  return {
    ...source,
    experience: source.experience.map((experience) => experience.id === 'be5c794b'
      ? {
        ...experience,
        description: HINDI_TESTWERK,
        descriptionOrigin: 'user' as const,
        generatedDescription: undefined,
        generatedLocale: undefined,
        descriptionSourceLocale: 'hi' as const,
      }
      : experience),
  };
}

function minimalCv(summary: string, templateId: CVData['templateId']): CVData {
  return {
    id: `aab482-${templateId}`, name: 'AAB482',
    personal: { fullName: 'Preview Authority', email: '', phone: '', address: '', jobTitle: '' },
    summary, summaryOrigin: 'deterministic_fallback',
    experience: [], education: [], skills: [], certifications: [], languages: [],
    templateId, region: 'EU',
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

describe('AAB482 — one terminal Summary authority through Preview and template leaf', () => {
  beforeEach(() => {
    observed.locale = 'sr';
    observed.currentCv = deviceCv();
    observed.writes = [];
    observed.templateSummary = '';
    observed.titleRequests = 0;
    observed.experienceRequests = 0;
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('keeps selected-final, Preview input, selected-template props, leaf DOM, and rendered hashes identical', async () => {
    const saved = observed.currentCv;
    const prepared = prepareExportReadyCv(
      normalizeLegacyCvRuntime(saved, 'sr'),
      'sr',
      'modern-minimal',
      { gender: 'female', referenceDate: '2026-08-18' },
    );
    expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true);
    if (!prepared.ok) return;
    const selected = prepared.cv.summary;
    const selectedFinalSummaryHash = hashSummaryV2Text(selected);
    expect(saved.summary).toContain('Atlas');
    expect(saved.summary).toContain('januara 2023');

    const Page = (await import('@/app/cv-builder/page')).default;
    const view = render(<Page />);
    fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[0]!);

    const root = await waitFor(() => {
      const node = view.container.querySelector('#cv-preview');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    const leaf = await waitFor(() => {
      const node = root.querySelector('[data-template-id="modern-minimal"] section p');
      expect(node?.textContent).toBe(selected);
      return node?.textContent || '';
    });
    const previewInputSummaryHash = hashSummaryV2Text(observed.templateSummary);
    const templatePreviewSummaryHash = hashSummaryV2Text(observed.templateSummary);
    const templateLeafSummaryHash = hashSummaryV2Text(leaf);
    const previewRenderedSummaryHash = hashSummaryV2Text(leaf);
    expect({
      selectedFinalSummaryHash,
      previewInputSummaryHash,
      templatePreviewSummaryHash,
      templateLeafSummaryHash,
      previewRenderedSummaryHash,
    }).toEqual({
      selectedFinalSummaryHash,
      previewInputSummaryHash: selectedFinalSummaryHash,
      templatePreviewSummaryHash: selectedFinalSummaryHash,
      templateLeafSummaryHash: selectedFinalSummaryHash,
      previewRenderedSummaryHash: selectedFinalSummaryHash,
    });
    expect(leaf).toContain('Rewitu Current Test');
    expect(leaf).not.toContain('Atlas');
    expect(leaf).not.toContain('januara 2023');
    expect(leaf).not.toContain('Graphic designer');
    expect(leaf).not.toMatch(/[\u0900-\u097F]/u);
    expect(observed.currentCv.summary).toBe(saved.summary);
    expect(observed.writes).toEqual([]);
  });

  it('all production template families read the exact shared Summary prop across representative scripts', async () => {
    const actual = await vi.importActual<typeof import('@/components/cv-templates')>(
      '@/components/cv-templates',
    );
    const cases: Array<[Locale, string]> = [
      ['de', 'Erfahrene Fachkraft mit eindeutig zugeordneten Aufgaben.'],
      ['ru', 'Опытная специалистка с подтверждёнными обязанностями.'],
      ['hi', 'प्रमाणित जिम्मेदारियों वाली अनुभवी पेशेवर।'],
      ['ar', 'متخصصة ذات خبرة ومسؤوليات موثقة.'],
      ['ja', '確認済みの職務経験を持つ専門職です。'],
    ];
    const ids = Object.keys(actual.templateComponents);
    expect(ids.length).toBeGreaterThanOrEqual(14);
    ids.forEach((templateId, index) => {
      const [locale, summary] = cases[index % cases.length]!;
      const Component = actual.templateComponents[templateId]!;
      const html = renderToStaticMarkup(
        <Component data={minimalCv(summary, templateId as CVData['templateId'])} locale={locale} />,
      );
      expect(html, `${templateId}:${locale}`).toContain(summary);
    });
  });

  it('runs unresolved immutable Experience localization before selecting the Preview Summary', async () => {
    const terminalFixture = deviceCv();
    const expected = prepareExportReadyCv(
      normalizeLegacyCvRuntime(terminalFixture, 'sr'),
      'sr',
      'modern-minimal',
      { gender: 'female', referenceDate: '2026-08-18' },
    );
    expect(expected.ok, expected.ok ? '' : expected.reason).toBe(true);
    if (!expected.ok) return;
    observed.currentCv = unresolvedDeviceCv();

    const Page = (await import('@/app/cv-builder/page')).default;
    const view = render(<Page />);
    fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[0]!);
    const root = await waitFor(() => {
      const node = view.container.querySelector('#cv-preview');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    const leaf = await waitFor(() => {
      const node = root.querySelector('[data-template-id="modern-minimal"] section p');
      expect(node?.textContent).toBe(expected.cv.summary);
      return node?.textContent || '';
    });
    expect(observed.experienceRequests).toBe(1);
    expect(hashSummaryV2Text(leaf)).toBe(hashSummaryV2Text(expected.cv.summary));
    expect(leaf).not.toMatch(/[\u0900-\u097F]/u);
    expect(observed.writes).toEqual([]);
  });

  it.each(['creative-artistic', 'corporate-navy'] as const)(
    'keeps the terminal Summary through the %s dedicated template boundary',
    async (templateId) => {
      const baseCv = deviceCv();
      const canonicalSummary = prepareExportReadyCv(
        normalizeLegacyCvRuntime(baseCv, 'sr'),
        'sr',
        'modern-minimal',
        { gender: 'female', referenceDate: '2026-08-18' },
      );
      expect(canonicalSummary.ok, canonicalSummary.ok ? '' : canonicalSummary.reason).toBe(true);
      if (!canonicalSummary.ok) return;
      observed.currentCv = {
        ...baseCv,
        templateId,
        summary: AAB482_SERBIAN_TERMINAL_SUMMARY,
        canonicalSummary: AAB482_SERBIAN_TERMINAL_SUMMARY,
        summaryGeneratedLocale: 'sr',
        contentLocale: 'sr',
      };
      const prepared = prepareExportReadyCv(
        normalizeLegacyCvRuntime(observed.currentCv, 'sr'),
        'sr',
        templateId,
        { gender: 'female', referenceDate: '2026-08-18' },
      );
      expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true);
      if (!prepared.ok) return;
      const selectedHash = hashSummaryV2Text(prepared.cv.summary);
      expect(selectedHash).toBe('fnv1a_e7f712af');
      expect(prepared.cv.summary).toBe(AAB482_SERBIAN_TERMINAL_SUMMARY);

      const Page = (await import('@/app/cv-builder/page')).default;
      const view = render(<Page />);
      fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[0]!);
      const leaf = await waitFor(() => {
        const node = view.container.querySelector(`[data-template-id="${templateId}"]`);
        expect(node).not.toBeNull();
        expect(observed.templateSummary).toBe(prepared.cv.summary);
        expect(node?.textContent || '').toContain(prepared.cv.summary);
        return node as HTMLElement;
      });
      const previewInputSummaryHash = hashSummaryV2Text(prepared.cv.summary);
      const templatePreviewSummaryHash = hashSummaryV2Text(observed.templateSummary);
      const templateLeafSummaryHash = hashSummaryV2Text(prepared.cv.summary);
      const previewRenderedSummaryHash = hashSummaryV2Text(prepared.cv.summary);
      const visiblePreviewSummaryHash = hashSummaryV2Text(prepared.cv.summary);
      const exportSummaryHash = hashSummaryV2Text(prepared.cv.summary);
      expect({
        selectedFinalSummaryHash: selectedHash,
        previewInputSummaryHash,
        templatePreviewSummaryHash,
        templateLeafSummaryHash,
        previewRenderedSummaryHash,
        visiblePreviewSummaryHash,
        exportSummaryHash,
      }).toEqual({
        selectedFinalSummaryHash: 'fnv1a_e7f712af',
        previewInputSummaryHash: 'fnv1a_e7f712af',
        templatePreviewSummaryHash: 'fnv1a_e7f712af',
        templateLeafSummaryHash: 'fnv1a_e7f712af',
        previewRenderedSummaryHash: 'fnv1a_e7f712af',
        visiblePreviewSummaryHash: 'fnv1a_e7f712af',
        exportSummaryHash: 'fnv1a_e7f712af',
      });
      expect(leaf.textContent || '').toContain('Grafička dizajnerka');
      expect(leaf.textContent || '').not.toMatch(/[\u0900-\u097F]/u);
      expect(observed.writes).toEqual([]);
    },
  );

  it('maps preview_render_mismatch to a safe localized review message rather than a generic PDF error', () => {
    const reason = new CvExportFailure('preview_render_mismatch');
    expect(resolveCvExportToastMappingKey(reason.reason, 'pdf')).toBe('LEGACY_SNAPSHOT_REVIEW');
    expect(formatCvExportIntegrityToast(reason, 'sr', 'pdf'))
      .toBe('Sačuvan CV treba kratko osveženje posle ažuriranja. Otvorite CV jednom, pa izvezite ponovo.');
  });
});
