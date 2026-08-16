/** AAB459: real provider-route semantic-relation ownership contract. */
/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { validateCrossLocaleSemanticCoverage } from '@/lib/cv-cross-locale-experience';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic { messages = { create: anthropicCreateMock }; },
}));

const SOURCE = [
  'ग्राफिक डिज़ाइन सामग्री को मुद्रित और डिजिटल माध्यमों के लिए तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'अंतिम परिणामों की गुणवत्ता सुनिश्चित करने के लिए डिज़ाइन परियोजनाओं की समीक्षा करती थी।',
].join(' ');

const SAFE = formatExperienceBullets([
  'Ha creato materiali grafici per supporti stampati e digitali.',
  'Ha sviluppato concetti di design visivo in base alle esigenze dei clienti.',
  'Ha revisionato progetti di design e verificato la qualità dei risultati finali.',
]);

function request() {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      action: 'bullets', locale: 'it', gender: 'female', position: 'Free text role',
      company: 'Example', industry: 'general', level: 'mid', sourceDescription: SOURCE,
      factAuthorityDescription: SOURCE, visibleDescription: 'Prior unedited AI output',
      experienceEntryId: 'be5c794b', isPresent: false, endDate: '2026-02', noopRepair: true,
      repairPromptHint: 'Use only immutable source facts and completed Italian past tense.',
    }),
  });
}

async function route() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

const unsafeCases = [
  ['tool_system', SAFE.replace('Ha creato', 'Ha utilizzato Salesforce e ha creato')],
  ['quantitative_metric', SAFE.replace('Ha creato', 'Ha creato').replace('.', ', aumentando le vendite del 40%.')],
  ['leadership_management', SAFE.replace('Ha creato', 'Ha diretto un team e ha creato')],
  ['unrelated_action', `${SAFE}\n• Ha organizzato eventi.`],
  ['borrowed_coordinate', `${SAFE}\n• Ha coordinato il magazzino.`],
  ['borrowed_manage', `${SAFE}\n• Ha gestito il magazzino.`],
  ['object_domain', SAFE.replace('materiali grafici', 'software aziendale')],
  ['frequency_scope', SAFE.replace('Ha creato', 'Ha creato quotidianamente')],
  ['universal_scope', SAFE.replace('Ha creato', 'Ha creato per tutti i progetti')],
  ['standards_compliance', SAFE.replace('Ha creato', 'Ha creato secondo gli standard stabiliti')],
  ['responsibility_escalation', SAFE.replace('Ha revisionato', 'Ha garantito la qualità e ha revisionato')],
] as const;

describe('AAB459 real route semantic-relation ownership', () => {
  beforeEach(() => anthropicCreateMock.mockReset());
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks(); });

  it('accepts the source-owned Italian candidate through the actual route', async () => {
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: SAFE }] });
    const { POST } = await route();
    const response = await POST(request() as never);
    expect(response.status).toBe(200);
    expect((await response.json()).result).toBe(SAFE);
    expect(validateCrossLocaleSemanticCoverage(SOURCE, SAFE)).toMatchObject({ ok: true, addedSemanticArgumentCount: 0 });
  });

  it.each(unsafeCases)('rejects unauthorized %s through the actual route', async (_kind, candidate) => {
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: candidate }] });
    const { POST } = await route();
    const response = await POST(request() as never);
    const semantic = validateCrossLocaleSemanticCoverage(SOURCE, candidate);
    expect(response.status).toBe(422);
    expect((await response.json()).result).toBeUndefined();
    expect(semantic.ok).toBe(false);
    expect(semantic.addedSemanticArgumentCount).toBeGreaterThan(0);
    expect(semantic.reason).toMatch(/semantic_(?:relation_ownership_failed|argument_expansion)/);
  });
});
