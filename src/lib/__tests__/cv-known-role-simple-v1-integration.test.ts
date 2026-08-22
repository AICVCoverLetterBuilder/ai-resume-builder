import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import {
  runSimpleSummaryOperation,
  type SimpleSummaryProviderRequest,
  type SimpleSummaryStyle,
} from '@/lib/cv-summary-simple-v1';
import {
  captureCvRenderSnapshot,
  describeCvRenderTarget,
} from '@/lib/cv-render-model-simple-v1';
import { projectExperienceRoleDisplayTitles } from '@/lib/cv-known-role-simple-v1';
import { projectRirekishoGenderDisplay } from '@/lib/rirekisho-gender-display';

const SUMMARY = 'User-owned current Summary must not be rewritten by role presentation.';

function fixture(overrides: Partial<CVData> = {}): CVData {
  return {
    id: 'm4-integration',
    name: 'M4 integration fixture',
    personal: {
      fullName: 'Mila Petrović',
      email: 'mila@example.test',
      phone: '',
      address: 'Novi Sad',
      jobTitle: 'User-owned profile title',
      gender: 'female',
    },
    summary: SUMMARY,
    contentLocale: 'sr',
    experience: [{
      id: 'role-current',
      company: 'Nova Firma',
      position: 'Graphic Designer',
      positionProvenance: 'occupation_option',
      positionSourceKey: 'graphic_designer',
      positionSourceLocale: 'en',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: 'Kreira vizuelne koncepte i rasporede.',
    }],
    education: [],
    skills: ['Illustrator'],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}

async function captureSummaryRequest(options: {
  operation: 'generate' | 'rewrite';
  style?: SimpleSummaryStyle;
  cv?: CVData;
  uiLocale?: Locale;
}) {
  const source = options.cv ?? fixture();
  let current = source;
  let request: SimpleSummaryProviderRequest | undefined;
  const transport = vi.fn(async (value: SimpleSummaryProviderRequest) => {
    request = value;
    return { ok: false as const, resultKind: 'test_stop_before_provider_result' };
  });
  const result = await runSimpleSummaryOperation({
    operation: options.operation,
    ...(options.style ? { style: options.style } : {}),
    cv: source,
    uiLocale: options.uiLocale ?? 'de',
    transport,
    getCurrentCv: () => current,
    applyCv: (next) => { current = next; return true; },
    getUsageCount: () => 0,
    incrementUsage: vi.fn(),
  });
  return { source, current, request: request!, result, transport };
}

describe('Simple V1 known-role consumer integration', () => {
  it.each([
    ['generate', undefined],
    ['rewrite', 'shorter'],
    ['rewrite', 'stronger'],
    ['rewrite', 'professional'],
  ] as Array<['generate' | 'rewrite', SimpleSummaryStyle | undefined]>) (
    '19. M2 %s %s provider context receives the shared resolved role',
    async (operation, style) => {
      const run = await captureSummaryRequest({ operation, style });
      expect(run.request.facts.roles[0].position).toBe('Grafička dizajnerka');
      expect(run.request.contentLocale).toBe('sr');
      expect(run.request.facts.jobTitle).toBe('User-owned profile title');
      expect(run.request.operation).toBe(operation);
      expect(run.request.style).toBe(style);
      expect(run.transport).toHaveBeenCalledTimes(1);
    },
  );

  it('20. role context projection cannot mutate cv.summary or raw position', async () => {
    const source = fixture();
    const run = await captureSummaryRequest({ operation: 'generate', cv: source });
    expect(run.result.outcome).toBe('provider_failure');
    expect(run.source.summary).toBe(SUMMARY);
    expect(run.current.summary).toBe(SUMMARY);
    expect(source.experience[0].position).toBe('Graphic Designer');
  });

  it('21. the M3 render model derives the same role and preserves raw storage', () => {
    const source = fixture();
    const snapshot = captureCvRenderSnapshot(source);
    expect(snapshot.model.experience[0].position).toBe('Grafička dizajnerka');
    expect(snapshot.model.summary).toBe(SUMMARY);
    expect(source.experience[0].position).toBe('Graphic Designer');
    expect(source.experience[0].positionSourceKey).toBe('graphic_designer');
  });

  it('22. Preview, PDF, and DOCX descriptors share one role-bearing snapshot', () => {
    const source = fixture();
    const snapshots = ['preview', 'pdf', 'docx'].map(() => captureCvRenderSnapshot(source));
    const targets = snapshots.map((snapshot, index) => describeCvRenderTarget(
      snapshot,
      ['preview', 'pdf', 'docx'][index] as 'preview' | 'pdf' | 'docx',
    ));
    expect(new Set(snapshots.map((snapshot) => snapshot.model.experience[0].position)))
      .toEqual(new Set(['Grafička dizajnerka']));
    expect(new Set(targets.map((target) => target.renderModelHash)).size).toBe(1);
    expect(new Set(targets.map((target) => target.experienceHash)).size).toBe(1);
  });

  it('23. Cover Letter structured CV context can consume the same projection', () => {
    const source = fixture();
    const context = projectExperienceRoleDisplayTitles(
      source.experience,
      source.contentLocale!,
      source.personal.gender,
    );
    expect(context[0].position).toBe('Grafička dizajnerka');
    expect(context[0].company).toBe('Nova Firma');
    expect(source.experience[0].position).toBe('Graphic Designer');
  });

  it('24. changing only uiLocale leaves Summary and render role context Serbian', async () => {
    for (const uiLocale of ['en', 'de', 'ar', 'ja'] as const) {
      const summary = await captureSummaryRequest({
        operation: 'generate',
        cv: fixture(),
        uiLocale,
      });
      const render = captureCvRenderSnapshot(fixture());
      expect(summary.request.facts.roles[0].position, uiLocale).toBe('Grafička dizajnerka');
      expect(render.model.experience[0].position, uiLocale).toBe('Grafička dizajnerka');
    }
  });

  it('25. Japanese Rirekisho receives the native role before layout specialization', () => {
    const source = fixture({ contentLocale: 'ja', templateId: 'rirekisho', region: 'Japan' });
    const snapshot = captureCvRenderSnapshot(source);
    expect(snapshot.model.experience[0].position).toBe('グラフィックデザイナー');
    expect(projectRirekishoGenderDisplay(snapshot.model.personal.gender)).toBe('女');
    expect(snapshot.model.experience[0].startDate).toBe('2024-01');
    expect(snapshot.model.summary).toBe(SUMMARY);
  });

  it('26. free-text Summary, render, and Cover Letter context remain identical', async () => {
    const freeText = fixture({
      experience: [{
        ...fixture().experience[0],
        position: 'Lead Visual Unicorn Designer',
        positionProvenance: 'manual',
        positionUserEdited: true,
        positionSourceKey: undefined,
      }],
    });
    const summary = await captureSummaryRequest({ operation: 'generate', cv: freeText });
    const render = captureCvRenderSnapshot(freeText);
    const coverLetter = projectExperienceRoleDisplayTitles(
      freeText.experience,
      freeText.contentLocale!,
      freeText.personal.gender,
    );
    expect(summary.request.facts.roles[0].position).toBe('Lead Visual Unicorn Designer');
    expect(render.model.experience[0].position).toBe('Lead Visual Unicorn Designer');
    expect(coverLetter[0].position).toBe('Lead Visual Unicorn Designer');
  });
});
