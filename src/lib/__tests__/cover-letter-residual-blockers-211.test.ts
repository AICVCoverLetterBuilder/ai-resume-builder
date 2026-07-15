// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import {
  assembleCoverLetterContent,
  generateStructuredCoverLetterWithRetries,
} from '../cover-letter-generation';
import {
  buildDeterministicSparseCoverLetter,
  croatianPozicijuRolePhrase,
  validateCoverLetterGrounding,
} from '../cover-letter-grounding';
import { activateCoverLetterContentWithClientGrounding } from '../cover-letter-client-grounding';
import { resolveCoverLetterGenerationResult } from '../cover-letter-generation-resolve';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from '../cover-letter-grounding-diagnostics';
import { isCoverLetterDownloadAllowed } from '../cover-letter-flow';
import type { ActiveCoverLetterRequest } from '../cover-letter-flow';
import { normalizeCoverLetterGender } from '../cover-letter-gender';
import { splitMixedArabicDocxRuns } from '../cover-letter-docx-runs';
import { wrapLatinPdfParagraphLines } from '../cover-letter-latin-pdf-wrap';
import type { Locale } from '../i18n/translations';

const ROLE = 'Serviser automobila';
const COMPANY = 'Mercedes';
const NAME = 'Alex Carter';
const FACTS = buildCoverLetterFactSet({
  personalName: NAME,
  jobTitle: ROLE,
  companyName: COMPANY,
});

const LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

function letter(
  locale: Locale,
  gender: 'male' | 'female' | 'unspecified',
  tone: 'formal' | 'friendly' | 'confident',
) {
  return buildDeterministicSparseCoverLetter(locale, {
    candidateName: NAME,
    jobTitle: ROLE,
    companyName: COMPANY,
    factSet: FACTS,
    dateLine: '2026-07-15',
    gender,
    tone,
  });
}

function assertCompanyAttrRejected(draft: string, locale: Locale) {
  const result = validateCoverLetterGrounding(draft, FACTS, {
    locale,
    gender: 'female',
    stage: 'test',
  });
  expect(result.valid, draft).toBe(false);
  expect(
    result.violations.some((v) => v.kind === 'unsupported_company_attribute'),
    `${locale}: ${draft}`,
  ).toBe(true);
  expect(result.violations.some((v) => v.evidence?.includes(`locale=${locale}`))).toBe(true);
  expect(result.violations.some((v) => v.evidence?.includes('stage=test'))).toBe(true);
}

describe('build-211 residual blockers: shared company grounding', () => {
  test('rejects known-brand / quality / trust claims across locales for Mercedes', () => {
    assertCompanyAttrRejected(
      `${COMPANY} is a well-known automotive brand renowned for vehicle quality.`,
      'en',
    );
    assertCompanyAttrRejected(
      `${COMPANY} is known for excellence and committed to quality.`,
      'en',
    );
    assertCompanyAttrRejected(
      `${COMPANY} एक जाना-माना ऑटोमोबाइल ब्रांड है। मैं ${ROLE} पद के लिए आवेदन प्रस्तुत कर रही हूँ।`,
      'hi',
    );
    assertCompanyAttrRejected(
      `${COMPANY} एक सुपरिचित ऑटोमोबाइल ब्रांड है। मैं ${ROLE} पद के लिए आवेदन प्रस्तुत कर रही हूँ।`,
      'hi',
    );
    assertCompanyAttrRejected(
      `${COMPANY} est une marque qui suscite mon intérêt pour la qualité et le soin apportés à ses véhicules.`,
      'fr',
    );
    assertCompanyAttrRejected(
      `${COMPANY}は顧客との信頼関係を重視する企業として認識しており、応募します。`,
      'ja',
    );
    assertCompanyAttrRejected(
      `Mi motiva ${COMPANY} per la sua presenza nel mercato e per le opportunità di sviluppo che offre.`,
      'it',
    );
    assertCompanyAttrRejected(
      `${COMPANY} je poznata kompanija koja brine o klijentima i primenjuje visoke standarde.`,
      'sr',
    );
    assertCompanyAttrRejected(
      `${COMPANY} — известная компания; клиентский сервис занимает важное место.`,
      'ru',
    );
  });

  test('allows role-centered interest and subjective desire to join', () => {
    const allowed = [
      {
        locale: 'en' as const,
        draft: `I am interested in vehicle servicing in the ${ROLE} role at ${COMPANY}. I want to learn the responsibilities and contribute to customer support tasks of the role.`,
      },
      {
        locale: 'es' as const,
        draft: `${COMPANY} me interesa como posible lugar de desarrollo profesional en el puesto de ${ROLE}.`,
      },
      {
        locale: 'fr' as const,
        draft: `La possibilité d'occuper ce poste chez ${COMPANY} m'intéresse. Je souhaite accomplir les missions du poste avec sérieux.`,
      },
      {
        locale: 'hi' as const,
        draft: `${COMPANY} में इस पद पर कार्य करने का अवसर प्रेरक है। मैं साक्षात्कार के लिए उपलब्ध हूँ।`,
      },
      {
        locale: 'sr' as const,
        draft: `Želim da doprinesem kvalitetnoj podršci klijentima u ulozi ${ROLE} u kompaniji ${COMPANY}.`,
      },
    ];
    for (const { locale, draft } of allowed) {
      const result = validateCoverLetterGrounding(draft, FACTS, { locale, gender: 'female' });
      expect(result.violations.some((v) => v.kind === 'unsupported_company_attribute'), draft).toBe(
        false,
      );
    }
  });

  test('12-locale deterministic fallbacks validate without unsupported company attributes', () => {
    for (const locale of LOCALES) {
      const text = assembleCoverLetterContent(letter(locale, 'female', 'formal'), locale);
      const result = validateCoverLetterGrounding(text, FACTS, { locale, gender: 'female' });
      expect(result.valid, locale).toBe(true);
      expect(text).not.toMatch(/जाना-माना|सुपरिचित|सुप्रसिद्ध/);
      expect(text).not.toMatch(/qualité et (?:le )?soin apport/i);
      expect(text).not.toMatch(/well-known|renowned for/i);
    }
  });
});

describe('build-211 residual blockers: Hindi recovery', () => {
  test('validator rejects verified bad Hindi brand fame sentences', () => {
    for (const phrase of [
      'Mercedes एक जाना-माना ऑटोमोबाइल ब्रांड है',
      'Mercedes एक सुपरिचित ऑटोमोबाइल ब्रांड है',
    ]) {
      const result = validateCoverLetterGrounding(phrase, FACTS, {
        locale: 'hi',
        gender: 'female',
        stage: 'initial',
      });
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.kind === 'unsupported_company_attribute')).toBe(true);
    }
  });

  test('server path: invalid brand claim → repair attempt → fallback without bad phrases', async () => {
    const invented = {
      dateLine: '15 जुलाई 2026',
      greeting: `${COMPANY} की भर्ती टीम को,`,
      paragraph1: `मैं ${COMPANY} में ${ROLE} पद के लिए आवेदन प्रस्तुत कर रही हूँ और इस अवसर में सचमुच रुचि रखती हूँ।`,
      paragraph2: `${COMPANY} एक जाना-माना ऑटोमोबाइल ब्रांड है और मैं योगदान देना चाहती हूँ।`,
      paragraph3: `${COMPANY} की उत्पाद गुणवत्ता मुझे प्रेरित करती है, और मैं आपकी टीम में योगदान देने के लिए उत्सुक हूँ। ${COMPANY} एक सुपरिचित ऑटोमोबाइल ब्रांड है।`,
      closing: 'मैं साक्षात्कार में अपनी रुचि पर चर्चा करना चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
      signOff: 'सादर',
      candidateName: NAME,
    };
    let sawRepair = false;
    const result = await generateStructuredCoverLetterWithRetries({
      locale: 'hi',
      closing: 'सादर',
      candidateName: NAME,
      displayName: NAME,
      companyName: COMPANY,
      jobTitle: ROLE,
      languageName: 'Hindi',
      toneDesc: 'confident',
      variantNote: '',
      genderNote: '',
      gender: 'female',
      tone: 'confident',
      fallbackRole: ROLE,
      fallbackCompany: COMPANY,
      factSet: FACTS,
      generate: async (_attempt, _max, prompt) => {
        if (prompt.includes('GROUNDING REPAIR')) {
          sawRepair = true;
          return JSON.stringify({
            ...invented,
            paragraph2: `${COMPANY} एक सुपरिचित ऑटोमोबाइल ब्रांड है और मैं योगदान देना चाहती हूँ।`,
          });
        }
        return JSON.stringify(invented);
      },
    });
    expect(sawRepair).toBe(true);
    expect(result.repairAttempted).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    const text = assembleCoverLetterContent(result.letter, 'hi');
    expect(text).not.toContain('जाना-माना');
    expect(text).not.toContain('सुपरिचित');
    expect(text).toContain('प्रस्तुत कर रही हूँ');
    expect(text).toContain('मैं साक्षात्कार के लिए उपलब्ध हूँ');
    expect(text).toMatch(/व्यावसायिक विकास|जिम्मेदार योगदान|Serviser automobila/);
    expect(validateCoverLetterGrounding(text, FACTS, { locale: 'hi', gender: 'female' }).valid).toBe(
      true,
    );
  });

  test('resolve activation recovers Hindi male/friendly without brand fame', () => {
    const active: ActiveCoverLetterRequest = {
      requestId: 'hi-block-1',
      locale: 'hi',
      gender: 'male',
    };
    const resolved = resolveCoverLetterGenerationResult({
      active,
      requestId: 'hi-block-1',
      requestedLocale: 'hi',
      selectedLocale: 'hi',
      selectedGenderRaw: 'male',
      requestedGenderNormalized: 'male',
      serverContent: `${COMPANY} एक जाना-माना ऑटोमोबाइल ब्रांड है। मैं ${ROLE} के लिए आवेदन करता हूँ।`,
      serverGroundingRaw: 'passed',
      backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
      candidateName: NAME,
      jobTitle: ROLE,
      companyName: COMPANY,
      factSet: FACTS,
      tone: 'friendly',
    });
    expect(resolved.outcome === 'success' || resolved.outcome === 'recovered').toBe(true);
    expect(resolved.content.trim().length).toBeGreaterThan(0);
    expect(resolved.content).not.toContain('जाना-माना');
    expect(resolved.content).not.toContain('सुपरिचित');
    expect(resolved.content).toContain('प्रस्तुत कर रहा हूँ');
    expect(
      isCoverLetterDownloadAllowed(
        resolved.content,
        'hi',
        'hi',
        'success',
        resolved.groundingStatus,
      ),
    ).toBe(true);
  });
});

describe('build-211 residual blockers: Arabic friendly', () => {
  test('rejects طلبتي application phrases and incomplete ويسعدني فرصة', () => {
    for (const draft of [
      'وأرحب بمناقشة طلبتي بأسلوب تعاوني',
      'أود التحدث حول طلبتي مع الفريق',
      'ويسعدني فرصة الانضمام إلى فريقكم',
    ]) {
      const result = validateCoverLetterGrounding(draft, FACTS, {
        locale: 'ar',
        gender: 'male',
        stage: 'initial',
      });
      expect(result.valid, draft).toBe(false);
      expect(result.violations.some((v) => v.kind === 'locale_quality')).toBe(true);
    }
  });

  test('male friendly fallback uses طلبي, natural join wording, no repeats', () => {
    const text = assembleCoverLetterContent(letter('ar', 'male', 'friendly'), 'ar');
    expect(text).toContain('طلبي');
    expect(text).not.toContain('طلبتي');
    expect(text).not.toContain('ويسعدني فرصة');
    expect(text).toContain('ويسعدني الانضمام');
    expect(text).toContain('متاح');
    expect(text).toContain(ROLE);
    expect((text.match(/معرفة المزيد/g) ?? []).length).toBeLessThan(2);
    expect(validateCoverLetterGrounding(text, FACTS, { locale: 'ar', gender: 'male' }).valid).toBe(
      true,
    );
    const formal = assembleCoverLetterContent(letter('ar', 'male', 'formal'), 'ar');
    expect(text).not.toEqual(formal);
  });

  test('female confident regression and DOCX Latin role order', () => {
    const confident = assembleCoverLetterContent(letter('ar', 'female', 'confident'), 'ar');
    expect(confident).toContain('مستعدة');
    expect(confident).not.toContain('طلبتي');
    expect((confident.match(/معرفة المزيد/g) ?? []).length).toBeLessThan(2);

    const line = `أتقدم بطلب لشغل وظيفة ${ROLE} لدى شركة ${COMPANY}، وأرحب بفرصة مناقشة طلبي معكم بأسلوب تعاوني.`;
    const runs = splitMixedArabicDocxRuns(line);
    const roleRun = runs.find((r) => r.text.includes(ROLE));
    expect(roleRun).toBeDefined();
    expect(roleRun!.rightToLeft).toBe(false);
    expect(line).toContain('طلبي');
    expect(line).not.toContain('طلبتي');
    expect(line).not.toContain('ويسعدني فرصة');
  });

  test('client activation never surfaces Arabic grammar blockers', () => {
    const activation = activateCoverLetterContentWithClientGrounding({
      serverContent:
        `أتقدم بطلب لشغل وظيفة ${ROLE} لدى شركة ${COMPANY}، ويسعدني فرصة الانضمام إلى فريقكم. وأرحب بمناقشة طلبتي بأسلوب تعاوني.`,
      serverGroundingRaw: 'passed',
      backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
      locale: 'ar',
      candidateName: NAME,
      jobTitle: ROLE,
      companyName: COMPANY,
      factSet: FACTS,
      gender: 'male',
      tone: 'friendly',
    });
    expect(activation.accepted).toBe(true);
    expect(activation.clientFallbackUsed).toBe(true);
    expect(activation.content).toContain('طلبي');
    expect(activation.content).not.toContain('طلبتي');
    expect(activation.content).not.toContain('ويسعدني فرصة');
    expect(activation.content.trim().length).toBeGreaterThan(0);
  });
});

describe('build-211 residual blockers: Croatian female formal', () => {
  test('rejects verified sparse / unnatural Croatian phrases', () => {
    for (const draft of [
      'Želim usvojiti očekivanja uloge i doprinositi timu.',
      `Pozicija ${ROLE} zanima me kao smislen sljedeći korak.`,
      'Ovim putem prijavila sam se za poziciju u tvrtki Mercedes.',
      'Prijavljujem se za poziciju Saradnika za podršku.',
    ]) {
      const result = validateCoverLetterGrounding(draft, FACTS, {
        locale: 'hr',
        gender: 'female',
      });
      expect(result.valid, draft).toBe(false);
      expect(result.violations.some((v) => v.kind === 'locale_quality')).toBe(true);
    }
  });

  test('formal female fallback is substantial with quoted title', () => {
    expect(croatianPozicijuRolePhrase(ROLE)).toBe(`poziciju „${ROLE}“`);
    const text = assembleCoverLetterContent(letter('hr', 'female', 'formal'), 'hr');
    expect(text).toContain(`poziciju „${ROLE}“`);
    expect(text).toContain('Ovim putem se prijavljujem');
    expect(text).toContain('Spremna sam');
    expect(text).toContain('Bila bih zahvalna');
    expect(text).toContain('Dostupna sam');
    expect(text).not.toContain('usvojiti očekivanja uloge');
    expect(text).not.toMatch(/Pozicija .+ zanima me kao smislen/);
    expect(text).not.toContain('Ovim putem prijavila sam se');
    expect(text.length).toBeGreaterThan(280);
    expect(validateCoverLetterGrounding(text, FACTS, { locale: 'hr', gender: 'female' }).valid).toBe(
      true,
    );

    const male = assembleCoverLetterContent(letter('hr', 'male', 'formal'), 'hr');
    expect(male).toContain('Spreman sam');
    expect(male).toContain('Bio bih zahvalan');
    const unspecified = assembleCoverLetterContent(letter('hr', 'unspecified', 'formal'), 'hr');
    expect(unspecified).toContain(`poziciju „${ROLE}“`);
    expect(unspecified).not.toMatch(/\bSpremna sam\b|\bSpreman sam\b/);
  });
});

describe('build-211 residual blockers: French female formal', () => {
  test('rejects company-quality claim and ma demande closing', () => {
    const quality = validateCoverLetterGrounding(
      `${COMPANY} est une marque qui suscite mon intérêt pour la qualité et le soin apportés à ses véhicules.`,
      FACTS,
      { locale: 'fr', gender: 'female' },
    );
    expect(quality.valid).toBe(false);
    expect(quality.violations.some((v) => v.kind === 'unsupported_company_attribute')).toBe(true);

    const closing = validateCoverLetterGrounding(
      "Je vous remercie de l'attention que vous porterez à ma demande.",
      FACTS,
      { locale: 'fr', gender: 'female' },
    );
    expect(closing.valid).toBe(false);
    expect(closing.violations.some((v) => v.kind === 'locale_quality')).toBe(true);
  });

  test('formal female fallback uses candidature closing and role-centered interest', () => {
    const text = assembleCoverLetterContent(letter('fr', 'female', 'formal'), 'fr');
    expect(text).toContain('Madame, Monsieur,');
    expect(text).toContain('intéressée');
    expect(text).toContain("l'attention portée à ma candidature");
    expect(text).not.toContain('ma demande');
    expect(text).not.toContain('votre temps et votre considération');
    expect(text).toMatch(/entretien et au service automobile|responsabilités liées/);
    expect(text).not.toMatch(/qualité et (?:le )?soin apport/i);
    expect(validateCoverLetterGrounding(text, FACTS, { locale: 'fr', gender: 'female' }).valid).toBe(
      true,
    );
  });
});

describe('build-211 residual blockers: non-regression guards', () => {
  test('Spanish female formal remains substantial without banned phrases', () => {
    const text = assembleCoverLetterContent(letter('es', 'female', 'formal'), 'es');
    expect(text).not.toContain('aprender en el rol');
    expect(text).not.toContain('aportar con decisión');
    expect(text).not.toContain('El puesto me resulta de verdadero interés');
    expect(text.length).toBeGreaterThan(220);
    expect(validateCoverLetterGrounding(text, FACTS, { locale: 'es', gender: 'female' }).valid).toBe(
      true,
    );
    const lines = wrapLatinPdfParagraphLines(
      'La oportunidad de desempeñar el puesto de Serviser automobila en Mercedes representa desarrollo profesional relevante para mi candidatura.',
      { maxWidth: 140 },
    );
    for (const line of lines) {
      expect(line).not.toMatch(/\b\w\s+\w\s+\w\s+\w\b/);
    }
  });

  test('Japanese formal keeps 敬具 and grounding cleanliness', () => {
    const text = assembleCoverLetterContent(letter('ja', 'unspecified', 'formal'), 'ja');
    expect(text).toContain('敬具');
    expect(text).not.toContain('として認識しており');
    expect(validateCoverLetterGrounding(text, FACTS, { locale: 'ja' }).valid).toBe(true);
  });

  test('active-result recovery never activates a blank preview', () => {
    const active: ActiveCoverLetterRequest = {
      requestId: 'blank-guard',
      locale: 'fr',
      gender: normalizeCoverLetterGender('female'),
    };
    const resolved = resolveCoverLetterGenerationResult({
      active,
      requestId: 'blank-guard',
      requestedLocale: 'fr',
      selectedLocale: 'fr',
      selectedGenderRaw: 'female',
      requestedGenderNormalized: 'female',
      serverContent:
        "Mercedes est une marque reconnue. Je vous remercie de l'attention que vous porterez à ma demande.",
      serverGroundingRaw: 'passed',
      backendRevision: COVER_LETTER_GROUNDING_BACKEND_REVISION,
      candidateName: NAME,
      jobTitle: ROLE,
      companyName: COMPANY,
      factSet: FACTS,
      tone: 'formal',
    });
    expect(resolved.outcome).toBe('recovered');
    expect(resolved.content.trim().length).toBeGreaterThan(80);
    expect(resolved.content).toContain('candidature');
    expect(resolved.content).not.toContain('ma demande');
  });
});
