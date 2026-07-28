/**
 * @vitest-environment jsdom
 *
 * AAB 297 regressions:
 * 1) Reject bare Hindi Summary `… का अनुभव।` nominal fragments; rebuild finite.
 * 2) Internal diagnostics/Reset visibility behind compile-time internal gate +
 *    seven-tap unlock (shared menu).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import {
  analyzeHindiSummaryEmploymentQuality,
  splitHindiSummaryUnits,
  validateHindiSummaryFiniteGrammar,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297,
  HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION,
  HINDI_PRINT_CLAIM_RE,
  sourceSupportsHindiPrintMedium,
  buildHindiPriorDesignSentence,
  scanHindiUnsupportedDesignMediumClaims,
} from '../cv-summary-grounding';

const WH_HI = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const GD_HI_DIGITAL = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों / स्क्रीन के लिए अनुकूलित किया।',
]);

const GD_HI_WITH_PRINT = formatExperienceBullets([
  'प्रिंट और डिजिटल दोनों माध्यमों के लिए ग्राफिक डिज़ाइन तैयार किया।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
]);

/** Exact AAB-297 device Summary — print fixed, but bare `का अनुभव।` duty fragment. */
const DEVICE_297 = `जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर हैं। आने वाले माल और संबंधित दस्तावेज़ों की जाँच तथा सहकर्मियों के साथ माल की तैयारी और आवाजाही के समन्वय का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में दृश्य सामग्री और ग्राफिक तत्व तैयार किए, डिज़ाइन सामग्री की समीक्षा व अनुकूलन किया तथा अंतिम डिज़ाइन फ़ाइलें विभिन्न प्रारूपों और स्क्रीन के लिए तैयार कीं।`;

function fixtureCv(options: { summary?: string; priorDesc?: string } = {}): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      location: 'Beograd',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary: options.summary ?? 'पूर्व सारांश अपरिवर्तित रखें।',
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
        description: options.priorDesc ?? GD_HI_DIGITAL,
        descriptionOrigin: 'user',
        originalUserDescription: options.priorDesc ?? GD_HI_DIGITAL,
        canonicalDescription: options.priorDesc ?? GD_HI_DIGITAL,
        generatedLocale: 'hi',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'hi',
  };
}

describe('AAB 297 Hindi Summary nominal fragment grammar', () => {
  it('exposes AAB-298 medium/grammar revision markers', () => {
    expect(HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION).toBe('hindi-summary-nominal-grammar-298-v1');
    expect(HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION).toBe('hindi-summary-nominal-grammar-298-v1');
    expect(HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297).toBe('hindi-summary-medium-grammar-297-v1');
  });

  it('1: rejects bare …का अनुभव', () => {
    const g = validateHindiSummaryFiniteGrammar(
      ['आने वाले माल की जाँच तथा समन्वय का अनुभव'],
      ['current_duty'],
    );
    expect(g.ok).toBe(false);
    expect(g.hindiGrammarRejectionReason).toBe('nominal_experience_fragment');
    expect(g.hindiNominalExperienceFragmentDetected).toBe(true);
    expect(g.hindiSentenceHasFiniteCopulaOrVerb[0]).toBe(false);
  });

  it('2: accepts …का अनुभव है', () => {
    const g = validateHindiSummaryFiniteGrammar(
      ['उन्हें गोदाम संचालन का अनुभव है'],
      ['current_duty'],
    );
    expect(g.ok).toBe(true);
    expect(g.hindiNominalExperienceFragmentDetected).toBe(false);
    expect(g.hindiSentenceHasFiniteCopulaOrVerb[0]).toBe(true);
  });

  it('3: accepts …का अनुभव रखती हैं', () => {
    const g = validateHindiSummaryFiniteGrammar(
      ['माल की जाँच और रिकॉर्ड प्रबंधन का अनुभव रखती हैं'],
      ['current_duty'],
    );
    expect(g.ok).toBe(true);
    expect(g.hindiSentenceHasFiniteCopulaOrVerb[0]).toBe(true);
  });

  it('4: rejects other bare nominal Summary endings', () => {
    for (const bare of [
      'गोदाम संचालन का कार्य',
      'माल जाँच की जिम्मेदारी',
      'रिकॉर्ड प्रबंधन में दक्षता',
    ]) {
      const g = validateHindiSummaryFiniteGrammar([bare], ['current_duty']);
      expect(g.ok, bare).toBe(false);
      expect(g.hindiGrammarRejectionReason, bare).toBe('nominal_experience_fragment');
    }
  });

  it('5/6: exact DEVICE_297 rejected or safely rebuilt to three finite sentences', () => {
    const units = splitHindiSummaryUnits(DEVICE_297);
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_297, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI_DIGITAL,
      priorCompany: 'Rewitu',
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.hindiNominalExperienceFragmentDetected).toBe(true);
    expect(q.hindiGrammarRejectionReason).toBe('nominal_experience_fragment');
    expect(q.hindiSentenceHasFiniteCopulaOrVerb.some((v) => v === false)).toBe(true);

    const grammar = validateHindiSummaryFiniteGrammar(units, q.finalUnitRoleSlots);
    expect(grammar.ok).toBe(false);
    expect(grammar.hindiGrammarRejectionReason).toBe('nominal_experience_fragment');

    const cv = fixtureCv({ summary: 'पुराना।' });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_297,
      referenceDateIso: '2026-07-20',
      originHint: 'ai_generated',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).not.toMatch(/का\s+अनुभव।/);
    expect(fin.text).toMatch(/का\s+अनुभव\s+(?:है|रखती\s+हैं)।|करती\s+हूँ।|कार्यरत\s+हूँ/);
    expect(fin.text).toMatch(/कार्यरत\s+हूँ|मेरे\s+पास/);
    const rebuiltUnits = splitHindiSummaryUnits(fin.text);
    expect(rebuiltUnits.length).toBeGreaterThanOrEqual(3);
    const q2 = analyzeHindiSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI_DIGITAL,
      priorCompany: 'Rewitu',
    });
    expect(q2.groundingValidationPassed).toBe(true);
    expect(q2.grammarValidationPassed).toBe(true);
    expect(q2.hindiNominalExperienceFragmentDetected).toBe(false);
    expect(q2.hindiSentenceHasFiniteCopulaOrVerb.every(Boolean)).toBe(true);
    expect(q2.currentIntroSlotPresent).toBe(true);
    expect(q2.currentDutySlotPresent).toBe(true);
    expect(q2.priorRoleSlotPresent).toBe(true);
    expect(q2.totalDurationSlotPresent).toBe(true);
  });

  it('7: print remains absent when unsupported', () => {
    const cv = fixtureCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_297,
      referenceDateIso: '2026-07-20',
    });
    expect(fin.text).not.toMatch(HINDI_PRINT_CLAIM_RE);
  });

  it('8: explicit source print remains preserved', () => {
    expect(sourceSupportsHindiPrintMedium(GD_HI_WITH_PRINT)).toBe(true);
    const prior = buildHindiPriorDesignSentence({
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_HI_WITH_PRINT,
    });
    expect(prior).toMatch(/प्रिंट/);
    expect(scanHindiUnsupportedDesignMediumClaims(prior, GD_HI_WITH_PRINT)
      .finalUnsupportedDesignMediumCount).toBe(0);
  });

  it('9: duration exactly once', () => {
    const cv = fixtureCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_297,
      referenceDateIso: '2026-07-20',
    });
    expect((fin.text.match(/साढ़े\s*छह/g) || []).length).toBe(1);
    expect(fin.text).not.toMatch(/6\.5/);
  });

  it('10: usage increments once only after safe visible apply', () => {
    const cv = fixtureCv({ summary: 'पुराना।' });
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'summary_generate',
      candidate: DEVICE_297,
      referenceDateIso: '2026-07-20',
    });
    expect(pipe.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.stateCv.summary).not.toMatch(/का\s+अनुभव।/);
  });

  it('11: failed final validation preserves previous Summary and usage +0', () => {
    const previous = 'बाइट-फ़ॉर-बाइट पूर्व सारांश।';
    const cv = fixtureCv({ summary: previous });
    cv.experience = (cv.experience || []).map((e) => ({
      ...e,
      description: '',
      canonicalDescription: '',
      originalUserDescription: '',
    }));
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_enhance',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_297,
      referenceDateIso: '2026-07-20',
      originHint: 'ai_generated',
    });
    expect(fin.countedAsSuccess).toBe(false);
    expect(applyFinalizedSummaryToCv(cv, 'hi', fin).summary).toBe(previous);
  });
});

function setCompiledGate(value: 'true' | 'false' | undefined) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED;
  else process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED = value;
}

async function loadDiagModules() {
  vi.resetModules();
  const buildChannel = await import('@/lib/build-channel');
  const ui = await import('@/components/CvExportDiagnosticsControls');
  return { ...buildChannel, ...ui };
}

describe('AAB 297 internal diagnostics shared visibility gate', () => {
  const prev = process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED;

  afterEach(() => {
    cleanup();
    setCompiledGate(prev as 'true' | 'false' | undefined);
    vi.resetModules();
  });

  it('12/13/14/15: seven taps unlock menu; Reset + Experience + Summary controls visible when internal', async () => {
    setCompiledGate('true');
    const mod = await loadDiagModules();
    expect(mod.INTERNAL_AI_RESET_ENABLED).toBe(true);
    expect(mod.INTERNAL_AI_DIAGNOSTICS_REVISION).toBe('internal-ai-diagnostics-298-v1');
    expect(mod.INTERNAL_AI_RESET_BUNDLE_MARKER).toBe('CVPRO_INTERNAL_AI_RESET_ENABLED_V1');

    function Harness() {
      const { diagnosticsOpen, closeDiagnostics, onVersionTap } = mod.useSevenTapDiagnosticsOpener();
      return (
        <div>
          <button type="button" data-testid="version-tap" onClick={onVersionTap}>v</button>
          <mod.CvExportDiagnosticsModal open={diagnosticsOpen} onClose={closeDiagnostics} />
        </div>
      );
    }

    render(<Harness />);
    expect(screen.queryByTestId('cv-export-diagnostics-overlay')).toBeNull();
    for (let i = 0; i < 7; i += 1) {
      fireEvent.click(screen.getByTestId('version-tap'));
    }
    expect(await screen.findByTestId('cv-export-diagnostics-overlay')).toBeTruthy();
    expect(await screen.findByTestId('internal-ai-usage-reset-panel')).toBeTruthy();
    expect(screen.getByTestId('internal-ai-usage-reset-button')).toBeTruthy();
    expect(await screen.findByTestId('experience-ai-diagnostics-section')).toBeTruthy();
    expect(screen.getByText(/No Experience AI attempt recorded yet/i)).toBeTruthy();
    expect(await screen.findByTestId('summary-ai-diagnostics-section')).toBeTruthy();
    expect(screen.getByText(/No Summary AI attempt recorded yet/i)).toBeTruthy();
  }, 20_000);

  it('16: diagnostic controls survive remount / locale-like rerender', async () => {
    setCompiledGate('true');
    const mod = await loadDiagModules();
    const { rerender } = render(
      <mod.CvExportDiagnosticsModal open onClose={() => {}} />,
    );
    expect(await screen.findByTestId('experience-ai-diagnostics-section')).toBeTruthy();
    expect(screen.getByTestId('summary-ai-diagnostics-section')).toBeTruthy();
    expect(screen.getByTestId('internal-ai-usage-reset-panel')).toBeTruthy();
    rerender(<mod.CvExportDiagnosticsModal open onClose={() => {}} />);
    expect(screen.getByTestId('experience-ai-diagnostics-section')).toBeTruthy();
    expect(screen.getByTestId('summary-ai-diagnostics-section')).toBeTruthy();
    expect(screen.getByTestId('internal-ai-usage-reset-panel')).toBeTruthy();
  }, 20_000);

  it('17: locked production state does not expose internal controls', async () => {
    setCompiledGate('false');
    const mod = await loadDiagModules();
    expect(mod.INTERNAL_AI_RESET_ENABLED).toBe(false);

    function Harness() {
      const { diagnosticsOpen, closeDiagnostics, onVersionTap } = mod.useSevenTapDiagnosticsOpener();
      return (
        <div>
          <button type="button" data-testid="version-tap" onClick={onVersionTap}>v</button>
          <mod.CvExportDiagnosticsModal open={diagnosticsOpen} onClose={closeDiagnostics} />
        </div>
      );
    }

    render(<Harness />);
    for (let i = 0; i < 7; i += 1) {
      fireEvent.click(screen.getByTestId('version-tap'));
    }
    expect(await screen.findByTestId('cv-export-diagnostics-overlay')).toBeTruthy();
    expect(screen.queryByTestId('internal-ai-usage-reset-panel')).toBeNull();
    expect(screen.queryByTestId('experience-ai-diagnostics-section')).toBeNull();
    expect(screen.queryByTestId('summary-ai-diagnostics-section')).toBeNull();
    expect(screen.queryByText(/Reset AI test usage/i)).toBeNull();
  }, 20_000);
});
