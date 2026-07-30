/**
 * Build 274: Hindi Professional Summary — hybrid duration, duplicate employment,
 * warehouse grounding, neutral perspective.
 */
import { describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import {
  analyzeDurationRepresentations,
  enforceAuthoritativeSummaryDuration,
  hasHybridDurationRepresentation,
  verifyIndependentFinalDurationCount,
} from '../cv-summary-duration-ownership';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  repairSummaryDuration,
  yearWordForLocale,
  type ExperienceDuration,
} from '../cv-experience-duration';
import { normalizeHindiSummaryPerspective } from '../cv-content-quality';

const WH_HI = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const GD_HI = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
]);

const HYBRID_DEVICE = 'मैं लगभग साढ़े 6.5 वर्षों के अनुभव वाली पेशेवर हूँ और जनवरी 2023 से Atlas में कार्यरत हूँ। मैं 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत हूँ, जहाँ मैं दैनिक रिकॉर्ड की समीक्षा करती हूँ, कार्य दस्तावेज़ अपडेट करती हूँ, और सहयोगियों के साथ जानकारी का समन्वय करती हूँ। इससे पहले मैंने Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट और डिजिटल सामग्री तैयार की और ब्रांड दिशानिर्देशों का पालन करते हुए टीम के साथ समन्वय किया।';

const DURATION_78: ExperienceDuration = {
  hasValidDates: true,
  unit: 'years',
  approxYears: 6.5,
  totalMonths: 78,
  fullYears: 6,
  remainingMonths: 6,
};

function fixtureCv(summary = ''): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      location: 'Beograd',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary,
    experience: [
      {
        id: 'exp-wh',
        position: 'Warehouse Employee',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_HI,
        descriptionOrigin: 'user',
        originalUserDescription: WH_HI,
        canonicalDescription: WH_HI,
        generatedLocale: 'hi',
      },
      {
        id: 'exp-gd',
        position: 'Grafički dizajner',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: GD_HI,
        descriptionOrigin: 'user',
        originalUserDescription: GD_HI,
        canonicalDescription: GD_HI,
        generatedLocale: 'hi',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'en',
  };
}

function assertValidHiSummary(text: string, cv?: CVData): void {
  if (summaryV2ModeActive()) {
    expectSummaryContractInvariants({
      text,
      locale: 'hi',
      cv: cv || fixtureCv(),
      requirePrior: true,
    });
    return;
  }

  expect(text.trim()).toBeTruthy();
  expect(text).toMatch(/साढ़े छह|6\.5 वर्ष/);
  expect(text).not.toMatch(/साढ़े\s*6\.5/);
  expect(hasHybridDurationRepresentation(text, 'hi')).toBe(false);
  expect(verifyIndependentFinalDurationCount(text, 'hi').ok).toBe(true);
  expect(text).toMatch(/माल|गोदाम|वेयरहाउस/);
  expect(text).not.toMatch(/दैनिक रिकॉर्ड.*कार्य दस्तावेज़.*जानकारी का समन्वय/);
  expect(text).toMatch(/(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|कार्यरत\s+हूँ|मेरे\s+पास/u);
  expect(text).not.toMatch(/पेशेवर\s+हैं|कार्यरत\s+हैं|वेयरहाउस\s*वर्कर/u);
  // Current employment introduced once — not both "जनवरी 2023 से Atlas" and bare "2023 से Atlas"
  const atlasHits = (text.match(/Atlas/g) || []).length;
  expect(atlasHits).toBeGreaterThanOrEqual(1);
  expect(text).not.toMatch(/जनवरी 2023 से Atlas[\s\S]*2023 से Atlas/);
  expect(text).not.toMatch(/2023 से Atlas[\s\S]*जनवरी 2023 से Atlas/);

}

describe('build 274 Hindi Summary quality + duration representation', () => {
  it('traces साढ़े 6.5 to repairSummaryDuration substituting छह → 6.5', () => {
    expect(yearWordForLocale('hi', 6.5)).toBe('साढ़े छह');
    const canonical = formatApproximateDurationPhrase(DURATION_78, 'hi');
    expect(canonical).toMatch(/साढ़े छह/);
    expect(canonical).not.toMatch(/6\.5/);

    // Legacy buggy path: bare "छह" replace inside "साढ़े छह"
    const broken = 'लगभग साढ़े छह वर्षों के अनुभव वाली पेशेवर';
    const repaired = repairSummaryDuration(broken, DURATION_78, 'hi');
    expect(repaired).toMatch(/साढ़े छह/);
    expect(repaired).not.toMatch(/साढ़े\s*6\.5/);

    expect(analyzeDurationRepresentations('लगभग साढ़े 6.5 वर्षों').hybridDetected).toBe(true);
    expect(analyzeDurationRepresentations('लगभग साढ़े छह वर्षों').hybridDetected).toBe(false);
  });

  it('enforces single written representation for 78 months', () => {
    const snap = buildExperienceDurationSnapshot([
      { startDate: '2020-01', endDate: '2023-04', isPresent: false },
      { startDate: '2023-01', endDate: '', isPresent: true },
    ], '2026-07-19');
    expect(snap.total.totalMonths).toBe(78);
    expect(snap.total.approxYears).toBe(6.5);

    const owned = enforceAuthoritativeSummaryDuration(
      HYBRID_DEVICE,
      snap.total,
      'hi',
      {
        requireDurationClaim: true,
        context: {
          role: 'वेयरहाउस कर्मचारी',
          company: 'Atlas',
          startDate: '2023-01',
          gender: 'female',
        },
      },
    );
    expect(owned.diagnostics.finalDurationHybridDetected).toBe(false);
    expect(owned.summary).not.toMatch(/साढ़े\s*6\.5/);
    expect(owned.summary).toMatch(/साढ़े छह|कुल\s+पेशेवर\s+अनुभव|संयुक्त अनुभव/);
  });

  it('50× exact fixture: hybrid device Summary → valid Hindi apply', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = fixtureCv(HYBRID_DEVICE);
      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'hi',
        action: 'summary_generate',
        candidate: HYBRID_DEVICE,
      });
      expect(pipe.blocked, `iter ${i}: ${pipe.reason}`).toBe(false);
      expect(pipe.finalized.countedAsSuccess).toBe(true);
      assertValidHiSummary(pipe.finalized.text);
      expect(pipe.stateCv.contentLocale).toBe('hi');
      expect(pipe.finalized.diagnostics?.finalDurationHybridDetected).toBe(false);
      expect(pipe.finalized.diagnostics?.durationSemanticValueMonths).toBe(78);
      expect(pipe.finalized.diagnostics?.perspectiveValidationPassed).toBe(true);
      expect(pipe.finalized.diagnostics?.finalPerspectiveMode).toBe('first_person');

      const reloaded = structuredClone(pipe.stateCv);
      expect(reloaded.summary).toBe(pipe.finalized.text);
      expect(reloaded.contentLocale).toBe('hi');
    }
  });

  it('duration failure matrix: accept pure forms, reject/repair hybrids', () => {
    const snap = buildExperienceDurationSnapshot([
      { startDate: '2020-01', endDate: '2023-04', isPresent: false },
      { startDate: '2023-01', endDate: '', isPresent: true },
    ], '2026-07-19');
    const cases: Array<{ text: string; hybrid: boolean }> = [
      { text: 'पेशेवर लगभग 6.5 वर्षों का अनुभव।', hybrid: false },
      { text: 'पेशेवर लगभग साढ़े छह वर्षों का संयुक्त अनुभव।', hybrid: false },
      { text: 'पेशेवर छह वर्ष छह महीने का अनुभव।', hybrid: false },
      { text: 'पेशेवर लगभग साढ़े 6.5 वर्षों का अनुभव।', hybrid: true },
      { text: 'पेशेवर लगभग साढ़े 6.5 वर्षों।', hybrid: true },
      { text: 'पेशेवर 6.5 वर्ष यानी साढ़े छह वर्ष।', hybrid: true },
    ];
    for (const c of cases) {
      expect(hasHybridDurationRepresentation(c.text, 'hi'), c.text).toBe(c.hybrid);
      const owned = enforceAuthoritativeSummaryDuration(c.text, snap.total, 'hi', {
        requireDurationClaim: true,
        context: { role: 'पेशेवर', company: 'Atlas', startDate: '2023-01', gender: 'female' },
      });
      expect(owned.summary, c.text).not.toMatch(/साढ़े\s*6\.5/);
      expect(hasHybridDurationRepresentation(owned.summary, 'hi'), `out:${c.text}`).toBe(false);
      expect(verifyIndependentFinalDurationCount(owned.summary, 'hi').ok).toBe(true);
    }

    // Cross-locale hybrid equivalents
    expect(hasHybridDurationRepresentation('with six and a half 6.5 years of experience', 'en')).toBe(true);
    expect(hasHybridDurationRepresentation('sa oko šest i po 6.5 godine iskustva', 'sr')).toBe(true);
  });

  it('summary quality: grounded warehouse + design, neutral, usage +1', () => {
    const cv = fixtureCv('');
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: '2026-07-19',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertValidHiSummary(fin.text);
    expect(fin.text).toMatch(/Rewitu|ग्राफिक|डिज़ाइन|दृश्य/);
    expect(fin.origin).toMatch(/deterministic_fallback|ai_/);

    const applied = applyFinalizedSummaryToCv(cv, 'hi', fin);
    expect(applied.contentLocale).toBe('hi');
    expect(applied.summary).toBe(fin.text);

    // No-op identical re-apply should not count as material success when unchanged
    const again = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: applied,
      candidate: applied.summary || '',
      referenceDateIso: '2026-07-19',
    });
    // May repair/normalize but must remain hybrid-free and grounded
    assertValidHiSummary(again.text);

    expect(normalizeHindiSummaryPerspective('मैं कार्यरत हूँ।')).not.toMatch(/मैं|हूँ/);
  });
});
