/** AAB442: real /api/generate recovery contract. */
/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { validateCrossLocaleSemanticCoverage } from '@/lib/cv-cross-locale-experience';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const ENTRY_ID = 'be5c794b';
const ENTRY_HASH = 'fnv1a_be5c794b_l36_b100_e52';
const SOURCE_HASH = 'fnv1a_431c4554_l204_b2346_e2404';

function exactSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(([\s\S]*?)\);/)?.[1];
  if (!body) throw new Error('AAB432 exact source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets(${body});`)(formatExperienceBullets) as string;
}

const SAFE_FRENCH = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques.',
  'Développait des concepts de design visuel selon les besoins des clients.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);

const UNSAFE_FRENCH = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques et utilisait Salesforce pour suivre les KPI et augmenter les ventes de 40%.',
  'Développait des concepts de design visuel selon les besoins des clients et les exigences du projet.',
  'Examinait les projets de design et vérifiait la qualité des rendus finaux.',
]);
const INVALID_LOCALE = formatExperienceBullets([
  'Created visual materials for print and digital media.',
  'Developed visual design concepts according to client needs.',
  'Reviewed design projects and checked final-output quality.',
]);
const EXTRA_PROJECT_REQUIREMENTS = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques.',
  'Développait des concepts de design visuel selon les besoins des clients et les exigences du projet.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);
const EXTRA_STANDARDS_CRITERION = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques.',
  'Développait des concepts de design visuel selon les besoins des clients.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux selon des normes établies.',
]);
const EXTRA_UNIVERSAL_SCOPE = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques pour tous les projets.',
  'Développait des concepts de design visuel selon les besoins des clients.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);
const EXTRA_FOREIGN_TEAM_ARGUMENT = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques.',
  'Développait des concepts de design visuel selon les besoins des clients avec les membres de l’équipe de projet.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);

function request(body: Record<string, unknown>) {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function importRoute() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

const baseBody = {
  action: 'bullets',
  locale: 'fr',
  gender: 'female',
  position: 'Graphic Designer',
  company: 'TestWerk GmbH',
  industry: 'design',
  level: 'mid',
  sourceDescription: exactSource(),
  factAuthorityDescription: exactSource(),
  visibleDescription: 'Provider output not validated',
  experienceEntryId: ENTRY_ID,
  isPresent: false,
  endDate: '2026-02',
  noopRepair: true,
  repairPromptHint: 'Use only immutable source facts. Translate to French in completed past tense.',
};

describe('AAB442 real generate-route recovery', () => {
  beforeEach(() => anthropicCreateMock.mockReset());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('accepts safe cross-locale recovery through the real route', async () => {
    expect(exactSource()).toMatch(/[\u0900-\u097f]/u);
    expect(ENTRY_HASH).toBe('fnv1a_be5c794b_l36_b100_e52');
    expect(SOURCE_HASH).toBe('fnv1a_431c4554_l204_b2346_e2404');
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: SAFE_FRENCH }] });
    const { POST } = await importRoute();
    const response = await POST(request(baseBody) as never);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.result).toBe(SAFE_FRENCH);
    expect(data.usedFactIds).toHaveLength(3);
    expect(data.cvFidelityStatus).toMatch(/passed|repaired|fallback/);
    const semantic = validateCrossLocaleSemanticCoverage(exactSource(), SAFE_FRENCH);
    expect(semantic.coveredCount).toBe(3);
    expect(semantic.semanticArgumentCoveragePassed).toBe(true);
    expect(semantic.addedSemanticArgumentCount).toBe(0);
    expect(semantic.addedSemanticArgumentKinds).toEqual([]);
  });

  it('rejects unsupported recovery claims through the real route', async () => {
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: UNSAFE_FRENCH }] });
    const { POST } = await importRoute();
    const response = await POST(request(baseBody) as never);
    const data = await response.json();
    expect(response.status).toBe(422);
    expect(data.result).toBeUndefined();
    expect(data.error).toBeTruthy();
  });

  it.each([
    ['extra-project-requirements', EXTRA_PROJECT_REQUIREMENTS],
    ['extra-standards-criterion', EXTRA_STANDARDS_CRITERION],
    ['extra-universal-scope', EXTRA_UNIVERSAL_SCOPE],
    ['foreign-team-argument', EXTRA_FOREIGN_TEAM_ARGUMENT],
  ] as const)('rejects unsourced semantic argument: %s', async (_kind, candidate) => {
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: candidate }] });
    const { POST } = await importRoute();
    const response = await POST(request(baseBody) as never);
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.result).toBeUndefined();
    const semantic = validateCrossLocaleSemanticCoverage(exactSource(), candidate);
    expect(semantic.semanticArgumentCoveragePassed).toBe(false);
    expect(semantic.addedSemanticArgumentCount).toBeGreaterThan(0);
  });

  it('rejects a recovery candidate in the wrong locale', async () => {
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: INVALID_LOCALE }] });
    const { POST } = await importRoute();
    const response = await POST(request(baseBody) as never);
    expect(response.status).toBe(422);
  });

  it('fails closed when recovery is empty', async () => {
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: '' }] });
    const { POST } = await importRoute();
    const response = await POST(request(baseBody) as never);
    expect(response.status).toBe(422);
    const data = await response.json();
    expect(data.result).toBeUndefined();
  });
});
