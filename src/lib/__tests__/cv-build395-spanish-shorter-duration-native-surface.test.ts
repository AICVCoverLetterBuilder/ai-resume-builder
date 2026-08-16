/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  applyApproximateDurationPolicy,
  buildExperienceDurationSnapshot,
} from '@/lib/cv-experience-duration';
import {
  analyzeSummaryDurationSemantics,
} from '@/lib/cv-summary-duration-ownership';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildSummaryV2ManifestForCv,
  localizeSummaryV2Manifest,
  setSummaryV2EnabledForTests,
  type SummaryV2LocalizedManifest,
  type SummaryV2LocalizationTransport,
} from '@/lib/cv-summary-v2';
import { evaluateSummaryV2NativeSurface } from '@/lib/cv-summary-v2/native-surface';
import {
  AI_USAGE_SCHEMA_VERSION,
  getProAiUsageCount,
  persistProAiRecord,
} from '@/lib/ai-usage-policy';

const REF = '2026-08-01';

function deviceCv(summary = ''): CVData {
  return {
    id: 'aab-395-device-es',
    name: 'AAB 395 Spanish device fixture',
    personal: {
      fullName: 'Device Fixture', email: 'fixture@example.com', phone: '', address: '',
      jobTitle: 'Fahrradmechaniker', gender: 'male',
    },
    summary,
    experience: [
      {
        id: 'radwerk', position: 'Fahrradmechaniker', company: 'RadWerk',
        startDate: '2023-01', endDate: '', isPresent: true, generatedLocale: 'de',
        description: 'Führt Wartungsarbeiten an Fahrrädern durch.\nPrüft Fahrräder auf technische Mängel.\nTauscht defekte Bauteile an Fahrrädern aus.',
        originalUserDescription: 'Führt Wartungsarbeiten an Fahrrädern durch. Prüft Fahrräder auf technische Mängel. Tauscht defekte Bauteile an Fahrrädern aus.',
        descriptionOrigin: 'user',
      },
      {
        // Deliberate overlap proves unioned tenure is not double-counted.
        id: 'stadthotel', position: 'Rezeptionist', company: 'StadtHotel',
        startDate: '2023-02', endDate: '2023-12', isPresent: false, generatedLocale: 'de',
        description: 'Begrüßte Gäste herzlich an der Rezeption des Hotels.\nErfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen.\nBeantwortete Fragen der Gäste kompetent und serviceorientiert.',
        originalUserDescription: 'Begrüßte Gäste herzlich an der Rezeption des Hotels. Erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen. Beantwortete Fragen der Gäste kompetent und serviceorientiert.',
        descriptionOrigin: 'user',
      },
    ],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern', contentLocale: 'es',
  } as CVData;
}

const spanishTransport: SummaryV2LocalizationTransport = async ({ entries }) => ({
  targetLocale: 'es',
  entries: entries.map((entry) => {
    const current = entry.employmentState === 'present';
    const facts = current
      ? [
        'Realiza el mantenimiento de bicicletas.',
        'Inspecciona las bicicletas para detectar averías técnicas con orden.',
        'Sustituye los componentes defectuosos de las bicicletas.',
      ]
      : [
        'Recibió cordialmente a los huéspedes en la recepción del hotel.',
        'Registró y gestionó las reservas y los cambios solicitados.',
        'Respondió a las consultas de los huéspedes con competencia y orientación al servicio.',
      ];
    return {
      entryId: entry.entryId,
      localizedRoleTitle: current ? 'Mecánico de bicicletas' : 'Recepcionista de hotel',
      facts: entry.facts.map((fact, index) => ({
        factId: fact.factId,
        localizedText: facts[index] || facts[facts.length - 1],
      })),
    };
  }),
});

async function localized(cv: CVData): Promise<SummaryV2LocalizedManifest> {
  const manifest = buildSummaryV2ManifestForCv({ cv, locale: 'es', referenceDateIso: REF });
  expect(manifest).not.toBeNull();
  const result = await localizeSummaryV2Manifest({ manifest: manifest!, transport: spanishTransport });
  expect(result.reason).toBeNull();
  expect(result.manifest).not.toBeNull();
  return result.manifest!;
}

function finalize(cv: CVData, manifest: SummaryV2LocalizedManifest, style?: 'shorter' | 'stronger' | 'professional', candidate = '') {
  return finalizeCvAiFieldForApply({
    field: 'summary',
    action: style ? `summary_${style}` : 'summary_generate',
    requestedLocale: 'es',
    cv,
    candidate,
    referenceDateIso: REF,
    durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
    localizedSummaryManifest: manifest,
    ...(style ? { rewriteStyle: style } : {}),
  });
}

describe('AAB-395 Spanish Shorter semantic duration and native surface', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    persistProAiRecord({ schemaVersion: AI_USAGE_SCHEMA_VERSION, count: 6, updatedAt: REF });
  });
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('keeps 42-44 months in the 3.5-year bucket while 36 and 48 remain whole years', () => {
    for (const months of [42, 43, 44]) {
      const duration = applyApproximateDurationPolicy(months);
      const semantic = analyzeSummaryDurationSemantics(
        'Tengo unos tres años y medio de experiencia.', duration, 'es',
      );
      expect(semantic.renderedDurationSemanticMonths).toBe(42);
      expect(semantic.agreementPassed).toBe(true);
    }
    expect(analyzeSummaryDurationSemantics(
      'Tengo unos tres años de experiencia.', applyApproximateDurationPolicy(36), 'es',
    ).agreementPassed).toBe(true);
    expect(analyzeSummaryDurationSemantics(
      'Tengo unos cuatro años de experiencia.', applyApproximateDurationPolicy(48), 'es',
    ).agreementPassed).toBe(true);
  });

  it('runs Generate → Stronger → Shorter three times with 43-month truth and native donde links', async () => {
    for (let run = 0; run < 3; run += 1) {
      let cv = deviceCv();
      const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
      expect(duration.total.totalMonths).toBe(43);
      const manifest = await localized(cv);
      const generated = finalize(cv, manifest);
      expect(generated.blocked).toBe(false);
      cv = applyFinalizedSummaryToCv(cv, 'es', generated);
      const stronger = finalize(cv, manifest, 'stronger');
      expect(stronger.blocked).toBe(false);
      // The old 606-character expectation included an unowned generic
      // manner modifier. The semantic Stronger contract removes it.
      expect((stronger.text || '').length).toBe(596);
      cv = applyFinalizedSummaryToCv(cv, 'es', stronger);
      const shorter = finalize(cv, manifest, 'shorter');
      expect(shorter.blocked, `${run}:${shorter.reason}`).toBe(false);
      expect(shorter.countedAsSuccess).toBe(true);
      expect((shorter.text || '').length).toBeLessThan((stronger.text || '').length);
      expect(shorter.text).toMatch(/tres años y medio/iu);
      expect(shorter.text).toMatch(/RadWerk, donde /u);
      expect(shorter.text).toMatch(/StadtHotel, donde /u);
      expect(shorter.diagnostics?.authoritativeDurationMonths).toBe(43);
      expect(shorter.diagnostics?.finalRenderedDurationSemanticMonths).toBe(42);
      expect(shorter.diagnostics?.visibleRenderedDurationSemanticMonths).toBe(42);
      expect(shorter.diagnostics?.finalDurationSemanticDeltaMonths).toBe(-1);
      expect(shorter.diagnostics?.finalDurationSemanticAgreementPassed).toBe(true);
      expect(shorter.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
      expect(shorter.diagnostics?.coveredPriorDutyFactCount).toBe(3);
      expect(shorter.diagnostics?.meaningfulChangeDetected).toBe(true);
      expect(evaluateSummaryV2NativeSurface({ text: shorter.text || '', locale: 'es' })
        .nativeSurfaceValidationPassed).toBe(true);
    }
  });

  it('rejects a one-phrase three-year downgrade transactionally and preserves usage', async () => {
    const cv = deviceCv();
    const manifest = await localized(cv);
    const valid = finalize(cv, manifest);
    expect(valid.blocked).toBe(false);
    const downgraded = (valid.text || '').replace(/tres años y medio/iu, 'tres años');
    for (let run = 0; run < 3; run += 1) {
      const before = getProAiUsageCount();
      const rejected = finalize(cv, manifest, undefined, downgraded);
      expect(rejected.blocked).toBe(true);
      expect(rejected.reason).toBe('summary_duration_semantic_mismatch');
      expect(rejected.countedAsSuccess).toBe(false);
      expect(rejected.text).toBe(cv.summary);
      expect(rejected.diagnostics?.finalCandidateSource).toBe('none');
      expect(rejected.diagnostics?.finalPostconditionsPassed).toBe(false);
      expect(rejected.diagnostics?.finalRenderedDurationSemanticMonths).toBe(36);
      expect(rejected.diagnostics?.finalDurationSemanticAgreementPassed).toBe(false);
      expect(applyFinalizedSummaryToCv(cv, 'es', rejected).summary).toBe(cv.summary);
      expect(getProAiUsageCount()).toBe(before);
    }
  });

  it('rejects Spanish comma-splice role introductions while accepting donde linkage', () => {
    const bad = 'Tengo unos tres años y medio de experiencia. Actualmente trabajo como mecánico en RadWerk, realizo mantenimiento. Antes trabajé como recepcionista en StadtHotel, recibí a los huéspedes.';
    const good = bad
      .replace('RadWerk, realizo', 'RadWerk, donde realizo')
      .replace('StadtHotel, recibí', 'StadtHotel, donde recibí');
    expect(evaluateSummaryV2NativeSurface({ text: bad, locale: 'es' })
      .nativeSurfaceRejectionReasons).toContain('spanish_role_intro_comma_splice');
    expect(evaluateSummaryV2NativeSurface({ text: good, locale: 'es' })
      .nativeSurfaceRejectionReasons).not.toContain('spanish_role_intro_comma_splice');
  });

  it('keeps one semantic duration bucket across all five Summary actions', async () => {
    let cv = deviceCv();
    const manifest = await localized(cv);
    const generated = finalize(cv, manifest);
    expect(generated.blocked).toBe(false);
    cv = applyFinalizedSummaryToCv(cv, 'es', generated);
    const actions = [
      finalize(cv, manifest),
      finalize(cv, manifest, 'shorter'),
      finalize(cv, manifest, 'stronger'),
      finalize(cv, manifest, 'professional'),
    ];
    for (const result of [generated, ...actions]) {
      expect(result.blocked, result.reason).toBe(false);
      expect(result.diagnostics?.authoritativeDurationMonths).toBe(43);
      expect(result.diagnostics?.finalRenderedDurationSemanticMonths).toBe(42);
      expect(result.diagnostics?.finalDurationSemanticAgreementPassed).toBe(true);
    }
  });

});
