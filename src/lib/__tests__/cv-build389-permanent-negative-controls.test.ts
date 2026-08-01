/**
 * Permanent AAB-389 — negative controls.
 * Injected malformed candidates must reject without apply or usage.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import {
  evaluateNativeRealizationContract,
  evaluateSummaryV2NativeSurface,
  analyzeStrongerNativeSurface,
  setSummaryV2EnabledForTests,
} from '@/lib/cv-summary-v2';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';
import {
  aab389DeterministicSource,
  aab389FinalizeSummary,
  aab389SeedUsage,
  aab389Hash,
  AAB389_LOCALES,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

describe('AAB-389 permanent negative controls', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(200);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('contract rejects every reported defect class without false-green Stronger', () => {
    const cases: Array<{ label: string; text: string; locale: Locale; reason: RegExp }> = [
      {
        label: 'es malformed preterite',
        locale: 'es',
        text: 'Cuento con cinco años de experiencia. Actualmente trabajo como X en Y, donde sustituyé piezas.',
        reason: /locale_verb_morphology/u,
      },
      {
        label: 'pt-BR third-person present',
        locale: 'pt-BR',
        text: 'Tenho cinco anos de experiência. Atualmente trabalho como X na Y, onde substitui peças.',
        reason: /locale_verb_morphology|third_person_duty/u,
      },
      {
        label: 'ar third-person prior',
        locale: 'ar',
        text: 'أمتلك خمس سنوات من الخبرة. سابقاً عملت كـمساعد في Y، حيث راجع الدراجات وأعدّ الملاحظات.',
        reason: /third_person_duty/u,
      },
      {
        label: 'sr slash gender',
        locale: 'sr',
        text: 'Imam pet godina iskustva. Prethodno sam radio/la kao X u Y, gde sam pregledao bicikle.',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'hr slash gender',
        locale: 'hr',
        text: 'Imam pet godina iskustva. Prethodno sam radio/la kao X u Y, gdje sam pregledavao bicikle.',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'ru parenthetical gender',
        locale: 'ru',
        text: 'У меня пять лет опыта. Ранее я работал(а) на должности X в Y, где я проверял велосипеды.',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'hi slash gender',
        locale: 'hi',
        text: 'मेरे पास पाँच वर्षों का अनुभव है। मैं X के रूप में काम करता/करती हूँ।',
        reason: /unresolved_gender_placeholder/u,
      },
      {
        label: 'sr nominal duration',
        locale: 'sr',
        text: 'Sa oko pet i po godina iskustva. Trenutno radim kao X u Y, gde obavljam održavanje.',
        reason: /nominal_duration_fragment|incomplete_sentence/u,
      },
      {
        label: 'ja incomplete duration',
        locale: 'ja',
        text: '通算で約5年半。現在、YでXとして勤務しています。',
        reason: /nominal_duration_fragment|incomplete_sentence/u,
      },
      {
        label: 'ja mechanical joins',
        locale: 'ja',
        text: '通算で約5年半の実務経験があります。現在、YでXとして勤務しています。業務では整備を行う、また点検する。',
        reason: /unnatural_coordination/u,
      },
      {
        label: 'ru invalid role case',
        locale: 'ru',
        text: 'У меня пять лет опыта. Сейчас я работаю как Веломеханик в Y, где я проверяю велосипеды.',
        reason: /invalid_role_case/u,
      },
      {
        label: 'fr conjunction without subject',
        locale: 'fr',
        text: "J'ai cinq ans d'expérience. Je travaille actuellement comme X chez Y, où j'inspecte les vélos, ainsi que remplace les pièces.",
        reason: /unnatural_coordination/u,
      },
      {
        label: 'ar latin punctuation',
        locale: 'ar',
        text: 'أمتلك خمس سنوات من الخبرة. أعمل حالياً كـميكانيكي في Y، حيث أفحص الدراجات, وأستبدل القطع.',
        reason: /unnatural_coordination/u,
      },
      {
        label: 'hi subordinate fragment',
        locale: 'hi',
        text: 'मेरे पास पाँच वर्षों का अनुभव है। जहाँ साइकिलों की जाँच।',
        reason: /incomplete_sentence/u,
      },
      {
        label: 'it con ricore',
        locale: 'it',
        text: 'Dispongo di cinque anni di esperienza. Attualmente lavoro come X presso Y, dove eseguo con ricore la manutenzione.',
        reason: /misspelled_style_modifier|incomplete_sentence|unnatural/u,
      },
      {
        label: 'de zielgerichtet als',
        locale: 'de',
        text: 'Ich verfüge über fünf Jahre Berufserfahrung. Derzeit arbeite ich zielgerichtet als Mechaniker bei Y.',
        reason: /unnatural|incomplete|native/u,
      },
    ];

    for (const c of cases) {
      const contract = evaluateNativeRealizationContract({ text: c.text, locale: c.locale });
      const native = evaluateSummaryV2NativeSurface({ text: c.text, locale: c.locale });
      const strong = analyzeStrongerNativeSurface({
        sourceText: 'source placeholder text for stronger analysis',
        candidateText: c.text,
        locale: c.locale,
      });
      const joined = [
        ...contract.nativeRealizationRejectionReasons,
        ...native.nativeSurfaceRejectionReasons,
        ...strong.nativeStrongSurfaceRejectionReasons,
      ].join(' ');
      expect(joined, c.label).toMatch(c.reason);
      expect(strong.nativeStrongSurfacePassed, c.label).toBe(false);
      // Misspelled intensifiers are Stronger-surface failures; structural
      // native-surface may still pass when the rest of the sentence is finite.
      if (c.label !== 'it con ricore' && c.label !== 'de zielgerichtet als') {
        expect(native.nativeSurfaceValidationPassed, c.label).toBe(false);
      }
    }
  });

  it('style-saturated Stronger is a typed no-op: no write, no usage', () => {
    for (const locale of ['en', 'de', 'es', 'ja', 'ar'] as Locale[]) {
      const already = aab389DeterministicSource(locale, 'male');
      // First produce a Stronger surface, then re-apply as saturated.
      const first = aab389FinalizeSummary({
        locale,
        gender: 'male',
        action: 'stronger',
        existingSummary: already,
      });
      expect(first.blocked, locale).toBe(false);
      const saturated = first.text || '';
      aab389SeedUsage(200);
      const sat = aab389FinalizeSummary({
        locale,
        gender: 'male',
        action: 'stronger',
        existingSummary: saturated,
        candidate: saturated,
      });
      expect(sat.blocked, locale).toBe(true);
      expect(sat.countedAsSuccess, locale).toBe(false);
      expect(sat.reason, locale).toBe('style_no_safe_material_change');
      expect(getProAiUsageCount(), locale).toBe(200);
      expect(aab389Hash(sat.text || saturated)).toBe(aab389Hash(saturated));
    }
  });

  it('bad provider never applies unsupported claims on any locale', () => {
    for (const locale of AAB389_LOCALES) {
      const source = aab389DeterministicSource(locale, 'male');
      aab389SeedUsage(210);
      const fin = aab389FinalizeSummary({
        locale,
        gender: 'male',
        action: 'stronger',
        existingSummary: source,
        candidate: 'Team leader 99% FakeCorp Leadership owned work',
      });
      if (!fin.blocked) {
        expect(fin.text || '', locale).not.toMatch(/FakeCorp|99%|Team leader|owned work/iu);
        expect(fin.diagnostics?.providerAccepted, locale).toBe(false);
      } else {
        expect(fin.countedAsSuccess, locale).toBe(false);
        expect(getProAiUsageCount(), locale).toBe(210);
      }
    }
  });
});
