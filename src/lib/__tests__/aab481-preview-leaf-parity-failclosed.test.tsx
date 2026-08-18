/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CVData, WorkExperience } from '@/lib/types';
import { translations, type Locale } from '@/lib/i18n/translations';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';

const runtime = vi.hoisted(() => ({
  locale: 'sr' as Locale,
  currentCv: undefined as unknown as CVData,
  writes: [] as CVData[],
  titleRequests: 0,
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: runtime.locale, t: translations[runtime.locale] }),
}));

vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: runtime.currentCv,
    setCurrentCv: (next: CVData) => { runtime.currentCv = next; runtime.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => {
      runtime.currentCv = next;
      runtime.writes.push(next);
      return true;
    },
    isPro: true,
    canDownload: () => true,
    incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: vi.fn(),
    getProAiUsageCount: () => 0,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab481-preview-token' }),
  }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (_url: string, options: { body?: Record<string, unknown> }) => {
    const body = options.body || {};
    if (body.action === 'export-title-localize') {
      runtime.titleRequests += 1;
      const entries = Array.isArray(body.entries) ? body.entries as Array<Record<string, unknown>> : [];
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

function entry(options: {
  id: string;
  company: string;
  startDate: string;
  isPresent: boolean;
  description: string;
  position?: string;
}): WorkExperience {
  return {
    id: options.id,
    company: options.company,
    position: options.position || 'Grafička dizajnerka',
    startDate: options.startDate,
    endDate: options.isPresent ? '' : '2025-12',
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
    requestHash: 'aab481-device-testwerk',
  });
  const source = {
    id: 'aab481-device-five-entry', name: 'AAB481',
    personal: {
      fullName: 'Test Person', email: 'test@example.test', phone: '', address: '',
      jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false,
    },
    summary: '', summaryOrigin: 'deterministic_fallback' as const,
    summaryGeneratedLocale: 'sr' as const, contentLocale: 'sr' as const,
    experience: [
      entry({ id: '90ceb215', company: 'Rewitu Current Test', startDate: '2026-03', isPresent: true, description: SERBIAN_CURRENT }),
      testWerk,
      entry({ id: 'a221433', company: 'Rewitu', startDate: '2018-01', isPresent: false, description: SERBIAN_PRIOR }),
      entry({ id: 'b9d3a6a5', company: 'Atlas', startDate: '2023-01', isPresent: true, position: 'Skladišna radnica', description: 'Proveravam pristiglu robu.\nProveravam dokumentaciju.\nSarađujem sa kolegama.' }),
      entry({ id: '8da68c15', company: 'Pixel Studio', startDate: '2016-01', isPresent: false, position: 'Operaterka', description: 'Vodila sam evidenciju smena.' }),
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
  const stale = generated.replace(
    'u Rewitu Current Test, gde',
    'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
  );
  return { ...source, summary: stale };
}

describe('AAB481 — real Preview leaf authority and same-snapshot fail-closed parity', () => {
  beforeEach(() => {
    runtime.locale = 'sr';
    runtime.currentCv = deviceCv();
    runtime.writes = [];
    runtime.titleRequests = 0;
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('opens Preview before export and renders the async terminal Summary through the real selected template leaf', async () => {
    const stale = runtime.currentCv.summary;
    expect(stale).toContain('Atlas');
    expect(stale).toContain('januara 2023');

    const Page = (await import('@/app/cv-builder/page')).default;
    const view = render(<Page />);
    fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[0]!);

    const previewRoot = await waitFor(() => {
      const node = view.container.querySelector('#cv-preview');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    const renderedSummary = await waitFor(() => {
      const node = previewRoot.querySelector('[data-template-id="modern-minimal"] section p');
      expect(node?.textContent).toContain('Grafička dizajnerka');
      return node?.textContent || '';
    });
    expect(renderedSummary).toContain('Rewitu Current Test');
    expect(renderedSummary).not.toContain('Atlas');
    expect(renderedSummary).not.toContain('januara 2023');
    expect(renderedSummary).not.toMatch(/[\u0900-\u097F]/u);
    expect(renderedSummary).not.toContain('Graphic designer');
    expect(runtime.currentCv.summary).toBe(stale);
  });

});
