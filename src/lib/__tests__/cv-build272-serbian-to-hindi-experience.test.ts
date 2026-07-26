/**
 * Build 272 regression: Serbian Latin warehouse Experience → Hindi.
 * Exact real-device failure path from versionCode 272.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import type { Locale } from '../i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from '../cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import {
  buildCrossLocaleExperienceFallback,
  validateCrossLocaleSemanticCoverage,
} from '../cv-cross-locale-experience';
import {
  buildHindiWarehouseExperienceFallback,
  validateHindiWarehouseExperienceCoverage,
} from '../cv-hindi-experience-grounding';
import {
  detectAiContentScript,
  guessUnitLocale,
  resolveTargetScriptForLocale,
  validateAiUnitLocalePurity,
} from '../cv-ai-unit-locale-purity';
import { textMatchesRequestedFieldLocale } from '../cv-field-locale-integrity';
import { isWrongLanguageAiOutput } from '../cv-ai-locale-guard';

const SR_WH = formatExperienceBullets([
  'Proverava pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.',
  'Ažurira skladišnu evidenciju i vodi računa o urednom rasporedu robe.',
  'Koordiniše pripremu i kretanje robe u saradnji sa kolegama.',
]);

const HI_PROVIDER = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const HI_WITH_BRAND = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'SAP गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const HI_MIXED_EN = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'She updates warehouse records and keeps goods orderly every day.',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const HI_MIXED_SR = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'Ažurira skladišnu evidenciju i vodi računa o urednom rasporedu robe.',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const MARATHI_LIKE = formatExperienceBullets([
  'आम्ही येणाऱ्या मालाची तपासणी करतो आणि नोंदी ठेवतो.',
  'गोदामातील नोंदी अद्ययावत करतो आणि मालाची व्यवस्था ठेवतो.',
  'सहकाऱ्यांसोबत मालाची तयारी आणि हालचाल समन्वयित करतो.',
]);

const NEPALI_LIKE = formatExperienceBullets([
  'आउने माल र सम्बन्धित कागजात जाँच गरी सही रेकर्ड सुनिश्चित गर्छिन्।',
  'गोदामका रेकर्ड अद्यावधिक गर्छिन् र सामान व्यवस्थित राख्छिन्।',
  'सहकर्मीसँग मालको तयारी र आवागमनको समन्वय गर्छिन्।',
]);

function fixtureCv(): CVData {
  return {
    personal: {
      fullName: 'Ana Petrović',
      email: 'ana@example.com',
      phone: '',
      location: 'Beograd',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'exp-wh-sr-hi',
        position: 'Radnica u skladištu',
        company: 'Ztrew',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: SR_WH,
        originalUserDescription: SR_WH,
        canonicalDescription: SR_WH,
        generatedLocale: 'en',
        descriptionOrigin: 'user',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'en',
  };
}

describe('build 272 Serbian→Hindi Experience (exact regression)', () => {
  it('targetScript mapping for supported locales', () => {
    expect(resolveTargetScriptForLocale('hi')).toBe('devanagari');
    expect(resolveTargetScriptForLocale('ar')).toBe('arabic');
    expect(resolveTargetScriptForLocale('ru')).toBe('cyrillic');
    expect(resolveTargetScriptForLocale('ja')).toBe('cjk');
    expect(resolveTargetScriptForLocale('sr')).toBe('latin');
    expect(resolveTargetScriptForLocale('en')).toBe('latin');
    expect(resolveTargetScriptForLocale('de')).toBe('latin');
    expect(resolveTargetScriptForLocale('pt-BR')).toBe('latin');
  });

  it('Hindi vs Marathi/Nepali distinction on short CV units', () => {
    expect(guessUnitLocale(HI_PROVIDER.split('\n')[0], 'hi')).toBe('hi');
    expect(guessUnitLocale(MARATHI_LIKE.split('\n')[0], 'hi')).toBe('mr');
    expect(guessUnitLocale(NEPALI_LIKE.split('\n')[0], 'hi')).toBe('ne');
    expect(validateAiUnitLocalePurity(HI_PROVIDER, 'hi', { kind: 'experience_bullet', requireUnits: true }).ok).toBe(true);
    expect(validateAiUnitLocalePurity(MARATHI_LIKE, 'hi', { kind: 'experience_bullet', requireUnits: true }).ok).toBe(false);
    expect(validateAiUnitLocalePurity(NEPALI_LIKE, 'hi', { kind: 'experience_bullet', requireUnits: true }).ok).toBe(false);
  });

  it('50× provider Hindi apply: purity, coverage, locale metadata, usage +1', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = fixtureCv();
      const pipeline = runCvAiApplyPipeline({
        cv,
        locale: 'hi',
        action: 'experience_bullets',
        candidate: HI_PROVIDER,
        experienceId: 'exp-wh-sr-hi',
        industry: 'general',
        level: 'mid',
      });
      expect(pipeline.blocked, `iter ${i} ${pipeline.reason}`).toBe(false);
      const d = pipeline.finalized.diagnostics!;
      expect(d.targetScript).toBe('devanagari');
      expect(d.detectedLocaleByBullet).toEqual(['hi', 'hi', 'hi']);
      expect(d.detectedScriptByBullet).toEqual(['devanagari', 'devanagari', 'devanagari']);
      expect(d.wrongLocaleBulletCount).toBe(0);
      expect(d.wrongScriptBulletCount).toBe(0);
      expect(d.mixedLanguageBulletCount).toBe(0);
      expect(d.sourceLanguageLeakageDetected).toBe(false);
      expect(d.targetLocalePurityPassed).toBe(true);
      // Soft HI shells merge goods+docs and invent update/organization duties —
      // provider must be rejected; hard Hindi 3/3 fallback is selected.
      expect(d.providerAccepted).toBe(false);
      expect(Number(d.providerRequiredFactCount ?? d.requiredFactCount)).toBe(3);
      expect(Number(d.providerCoveredFactCount ?? 0)).toBeLessThan(3);
      expect(d.finalCandidateSource).toBe('deterministic_fallback');
      expect(Number(d.finalCoveredFactCount ?? d.coveredFactCount)).toBe(3);
      expect(Number(d.requiredFactCount)).toBe(3);
      expect(d.crossLocaleOperation).toBe(true);
      expect(d.translationProviderAttempted).toBe(true);
      expect(pipeline.finalized.countedAsSuccess).toBe(true);
      expect(pipeline.stateCv.contentLocale).toBe('hi');
      const exp = pipeline.stateCv.experience![0];
      expect(exp.generatedLocale).toBe('hi');
      expect(exp.description).toContain('जाँच');
      expect(exp.description).toContain('गोदाम');
      expect(exp.description).toContain('समन्वय');
      expect(exp.description).not.toMatch(/सही रिकॉर्ड सुनिश्चित|रिकॉर्ड अद्यतन|व्यवस्थित रख/);
      expect(/[A-Za-zÀ-ÖØ-öø-ÿ]{6,}/.test(exp.description.replace(/\b(?:SAP|SQL|API|Ztrew)\b/g, ''))).toBe(false);

      // Restart / reload preserves Hindi content + locale.
      const reloaded = structuredClone(pipeline.stateCv);
      expect(reloaded.contentLocale).toBe('hi');
      expect(reloaded.experience![0].generatedLocale).toBe('hi');
      expect(reloaded.experience![0].description).toBe(exp.description);
    }
  });

  it('failure matrix', () => {
    const cv = fixtureCv();

    const okBrand = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_WITH_BRAND,
      experienceId: 'exp-wh-sr-hi',
      industry: 'general',
      level: 'mid',
    });
    expect(okBrand.blocked).toBe(false);
    expect(okBrand.countedAsSuccess).toBe(true);

    const mixedEn = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_MIXED_EN,
      experienceId: 'exp-wh-sr-hi',
    });
    if (!mixedEn.blocked && mixedEn.countedAsSuccess) {
      // Repair path: must not retain the English clause.
      expect(mixedEn.text).not.toMatch(/She updates|warehouse records and keeps/i);
      expect(validateAiUnitLocalePurity(mixedEn.text, 'hi', {
        kind: 'experience_bullet',
        requireUnits: true,
      }).ok).toBe(true);
    } else {
      expect(mixedEn.countedAsSuccess).toBe(false);
      expect(cv.experience![0].description).toBe(SR_WH);
    }

    const mixedSr = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_MIXED_SR,
      experienceId: 'exp-wh-sr-hi',
    });
    if (!mixedSr.blocked && mixedSr.countedAsSuccess) {
      expect(mixedSr.text).not.toMatch(/Ažurira|skladišnu/);
      expect(validateAiUnitLocalePurity(mixedSr.text, 'hi', {
        kind: 'experience_bullet',
        requireUnits: true,
      }).ok).toBe(true);
    } else {
      expect(mixedSr.countedAsSuccess).toBe(false);
    }

    const marathi = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: MARATHI_LIKE,
      experienceId: 'exp-wh-sr-hi',
    });
    if (!marathi.blocked && marathi.countedAsSuccess) {
      expect(marathi.text).not.toMatch(/आम्ही|करतो/);
      expect(guessUnitLocale(splitExperienceBullets(marathi.text)[0] || '', 'hi')).toBe('hi');
    } else {
      expect(marathi.countedAsSuccess).toBe(false);
    }

    const nepali = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: NEPALI_LIKE,
      experienceId: 'exp-wh-sr-hi',
    });
    if (!nepali.blocked && nepali.countedAsSuccess) {
      expect(nepali.text).not.toMatch(/गर्छिन्|राख्छिन्/);
    } else {
      expect(nepali.countedAsSuccess).toBe(false);
    }

    const incomplete = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: formatExperienceBullets([
        'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
        'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
      ]),
      experienceId: 'exp-wh-sr-hi',
    });
    // Incomplete facts: reject or repair via fallback — never leave Serbian visible on success.
    if (!incomplete.blocked && incomplete.countedAsSuccess) {
      expect(incomplete.text).not.toMatch(/Proverava|Ažurira|Koordiniše/);
      expect(detectAiContentScript(incomplete.text)).toBe('devanagari');
    } else {
      expect(incomplete.countedAsSuccess).toBe(false);
      expect(cv.experience![0].description).toBe(SR_WH);
    }

    const wrongLocale = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: formatExperienceBullets([
        'Checks incoming goods and related documentation for accurate recording.',
        'Updates warehouse records and maintains orderly arrangement of goods.',
        'Coordinates preparation and movement of goods with colleagues.',
      ]),
      experienceId: 'exp-wh-sr-hi',
    });
    if (!wrongLocale.blocked && wrongLocale.countedAsSuccess) {
      expect(wrongLocale.origin).toBe('deterministic_fallback');
      expect(wrongLocale.text).not.toMatch(/Checks incoming|Updates warehouse|Coordinates preparation/);
      expect(validateAiUnitLocalePurity(wrongLocale.text, 'hi', {
        kind: 'experience_bullet',
        requireUnits: true,
      }).ok).toBe(true);
    } else {
      expect(wrongLocale.countedAsSuccess).toBe(false);
      expect(cv.experience![0].description).toBe(SR_WH);
    }

    const timeoutEmpty = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: '',
      experienceId: 'exp-wh-sr-hi',
    });
    // Empty provider → deterministic Hindi fallback may apply.
    if (!timeoutEmpty.blocked && timeoutEmpty.countedAsSuccess) {
      expect(timeoutEmpty.origin).toBe('deterministic_fallback');
      expect(textMatchesRequestedFieldLocale(timeoutEmpty.text, 'hi', 'experience_bullet')).toBe(true);
      expect(isWrongLanguageAiOutput(timeoutEmpty.text, 'hi')).toBe(false);
      expect(timeoutEmpty.text).not.toMatch(/Proverava|Ažurira|Koordiniše/);
      const hiCov = validateHindiWarehouseExperienceCoverage(SR_WH, timeoutEmpty.text);
      expect(hiCov.ok).toBe(true);
      expect(hiCov.covered.length).toBe(3);
    } else {
      expect(timeoutEmpty.countedAsSuccess).toBe(false);
      expect(cv.experience![0].description).toBe(SR_WH);
    }
  });

  it('target-pure deterministic Hindi fallback (no Latin prose)', () => {
    const fb = buildHindiWarehouseExperienceFallback({
      sourceDescription: SR_WH,
      isPresent: true,
      gender: 'female',
    });
    expect(fb.trim()).toBeTruthy();
    expect(fb).not.toMatch(/Proverava|Ažurira|Koordiniše|pristiglu|skladiš/);
    expect(fb).not.toMatch(/\b(?:the|and|with|checks|updates|coordinates)\b/i);
    const purity = validateAiUnitLocalePurity(fb, 'hi', { kind: 'experience_bullet', requireUnits: true });
    expect(purity.ok).toBe(true);
    expect(purity.detectedScriptByUnit.every((s) => s === 'devanagari')).toBe(true);
    expect(validateHindiWarehouseExperienceCoverage(SR_WH, fb).ok).toBe(true);
    const bullets = splitExperienceBullets(fb);
    expect(bullets).toHaveLength(3);
    // Soft cross-locale shells remain available but are no longer the warehouse authority.
    const soft = buildCrossLocaleExperienceFallback({
      sourceDescription: SR_WH,
      sourceLocale: 'sr',
      targetLocale: 'hi' as Locale,
      gender: 'female',
      isPresent: true,
      position: 'Radnica u skladištu',
    });
    expect(validateAiUnitLocalePurity(soft, 'hi', { kind: 'experience_bullet', requireUnits: true }).ok)
      .toBe(true);
    void validateCrossLocaleSemanticCoverage;
  });
});
