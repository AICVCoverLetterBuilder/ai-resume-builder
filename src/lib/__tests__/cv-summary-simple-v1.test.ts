import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import {
  runSimpleSummaryOperation,
  validateSimpleSummaryCandidate,
  type SimpleSummaryProviderRequest,
  type SimpleSummaryProviderResult,
  type SimpleSummaryStyle,
} from '@/lib/cv-summary-simple-v1';

const CANDIDATES: Record<Locale, string> = {
  en: 'Customer support specialist who handles customer requests and maintains clear order records. Brings organized communication and reliable service to daily work.',
  de: 'Kundenservicefachkraft mit Erfahrung in der Bearbeitung von Kundenanfragen und der Pflege klarer Auftragsunterlagen. Arbeitet organisiert, kommunikativ und zuverlässig.',
  es: 'Especialista en atención al cliente con experiencia gestionando consultas y manteniendo registros claros de pedidos. Aporta comunicación organizada y un servicio fiable.',
  fr: 'Spécialiste du service client, expérimenté dans le traitement des demandes et la tenue de dossiers de commande clairs. Apporte une communication organisée et un service fiable.',
  it: 'Specialista del servizio clienti con esperienza nella gestione delle richieste e nella tenuta ordinata dei registri. Offre comunicazione chiara e un servizio affidabile.',
  ar: 'متخصص في دعم العملاء يتمتع بخبرة في معالجة طلبات العملاء والحفاظ على سجلات الطلبات بوضوح. يقدم تواصلاً منظماً وخدمة موثوقة في العمل اليومي.',
  sr: 'Stručnjak za korisničku podršku sa iskustvom u obradi zahteva i urednom vođenju evidencije porudžbina. Donosi jasnu komunikaciju i pouzdanu svakodnevnu uslugu.',
  hr: 'Stručnjak za korisničku podršku s iskustvom u obradi upita i urednom vođenju evidencije narudžbi. Donosi jasnu komunikaciju i pouzdanu svakodnevnu uslugu.',
  ru: 'Специалист по поддержке клиентов с опытом обработки обращений и аккуратного ведения заказов. Обеспечивает ясное общение и надежное ежедневное обслуживание.',
  'pt-BR': 'Especialista em atendimento ao cliente com experiência no tratamento de solicitações e na manutenção de registros de pedidos. Oferece comunicação clara e serviço confiável.',
  hi: 'ग्राहक सहायता विशेषज्ञ, जिन्हें ग्राहकों के अनुरोध संभालने और ऑर्डर रिकॉर्ड व्यवस्थित रखने का अनुभव है। दैनिक कार्य में स्पष्ट संवाद और विश्वसनीय सेवा प्रदान करते हैं।',
  ja: '顧客からの問い合わせ対応と注文記録の整理に経験を持つカスタマーサポート担当者です。明確なコミュニケーションと信頼できる日常業務を大切にします。',
};

function makeCv(locale: Locale = 'en', summary = ''): CVData {
  return {
    id: 'cv-simple-1',
    name: 'Simple CV',
    personal: {
      fullName: 'Test Candidate',
      email: '',
      phone: '',
      address: '',
      jobTitle: 'Customer Support Specialist',
      gender: 'female',
    },
    summary,
    contentLocale: locale,
    summaryGeneratedLocale: 'de',
    canonicalSummary: 'Legacy canonical Summary that must not control Simple V1.',
    summaryOrigin: 'deterministic_fallback',
    summaryGenerationContextKey: 'legacy-context',
    experience: [{
      id: 'role-current',
      company: 'Acme Corporation',
      position: 'Customer Support Specialist',
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: 'Handles customer requests and maintains order records.',
      canonicalDescription: 'Legacy description that is not selected as authority.',
      generatedLocale: 'de',
    }, {
      id: 'role-prior',
      company: 'Northwind Ltd',
      position: 'Office Assistant',
      startDate: '2018-02',
      endDate: '2019-12',
      isPresent: false,
      description: 'Organized files and supported customer communication.',
    }],
    education: [{
      id: 'education-1',
      school: 'City College',
      degree: 'Business Administration',
      startDate: '2014',
      endDate: '2018',
      description: '',
    }],
    skills: ['Customer Support', 'Communication', 'Order Records'],
    certifications: [],
    languages: [{ name: 'English', level: 'advanced' }],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function execute(options: {
  cv?: CVData;
  uiLocale?: Locale;
  operation?: 'generate' | 'rewrite';
  style?: SimpleSummaryStyle;
  candidate?: unknown;
  providerResult?: SimpleSummaryProviderResult;
  mutateBeforeReturn?: (current: CVData) => CVData;
  applyAccepted?: boolean;
}) {
  const source = options.cv || makeCv();
  let current = source;
  let usage = 0;
  let applyCount = 0;
  let incrementCount = 0;
  let request: SimpleSummaryProviderRequest | undefined;
  const diagnostics = vi.fn();
  const result = await runSimpleSummaryOperation({
    operation: options.operation || 'generate',
    ...(options.style ? { style: options.style } : {}),
    cv: source,
    uiLocale: options.uiLocale || 'en',
    transport: async (value) => {
      request = value;
      if (options.mutateBeforeReturn) current = options.mutateBeforeReturn(current);
      return options.providerResult || { ok: true, candidate: options.candidate ?? CANDIDATES[source.contentLocale || 'en'], httpStatus: 200 };
    },
    getCurrentCv: () => current,
    applyCv: (next) => {
      applyCount += 1;
      if (options.applyAccepted === false) return false;
      current = next;
      return true;
    },
    getUsageCount: () => usage,
    incrementUsage: () => {
      incrementCount += 1;
      usage += 1;
    },
    recordDiagnostic: diagnostics,
  });
  return {
    result,
    current,
    usage,
    applyCount,
    incrementCount,
    request: request as SimpleSummaryProviderRequest,
    diagnostics,
  };
}

describe('Simple V1 unified Summary pipeline', () => {
  it('1. Generate applies a valid provider result to an empty Summary', async () => {
    const run = await execute({ cv: makeCv('en', '') });
    expect(run.result.outcome).toBe('applied');
    expect(run.current.summary).toBe(CANDIDATES.en);
    expect(run.usage).toBe(1);
  });

  it('2. Generate never sends the previous Summary as a factual source', async () => {
    const old = 'Old Summary text must never enter a Generate provider request.';
    const run = await execute({ cv: makeCv('en', old) });
    expect(run.request).not.toHaveProperty('sourceSummary');
    expect(JSON.stringify(run.request)).not.toContain(old);
  });

  it('3. uses cv.contentLocale instead of uiLocale', async () => {
    const run = await execute({ cv: makeCv('sr'), uiLocale: 'de', candidate: CANDIDATES.sr });
    expect(run.request.contentLocale).toBe('sr');
    expect(run.result.diagnostic).toMatchObject({ contentLocale: 'sr', uiLocale: 'de' });
  });

  it('4. provider failure does not apply or increment usage', async () => {
    const run = await execute({ providerResult: { ok: false, resultKind: 'provider_failure', httpStatus: 503 } });
    expect(run.result.outcome).toBe('provider_failure');
    expect(run.applyCount).toBe(0);
    expect(run.usage).toBe(0);
  });

  it('5. rejects an obviously wrong-language script without usage', async () => {
    const run = await execute({ cv: makeCv('ar'), candidate: CANDIDATES.en });
    expect(run.result.validationFailureReason).toBe('wrong_target_script');
    expect(run.applyCount).toBe(0);
    expect(run.usage).toBe(0);
  });

  it('6. rejects a newly invented employer', async () => {
    const run = await execute({
      candidate: 'Customer support specialist at Globex Corporation who handles requests and maintains clear order records with reliable daily communication.',
    });
    expect(run.result.validationFailureReason).toBe('invented_employer');
    expect(run.usage).toBe(0);
  });

  it('7. rejects an unsupported numeric achievement', async () => {
    const run = await execute({
      candidate: 'Customer support specialist who improved customer satisfaction by 35% while handling requests and maintaining clear order records.',
    });
    expect(run.result.validationFailureReason).toBe('unsupported_number');
    expect(run.usage).toBe(0);
  });

  it('8. Shorter applies a different valid candidate and increments once', async () => {
    const source = `${CANDIDATES.en} Provides additional administrative support across daily team activities.`;
    const run = await execute({ cv: makeCv('en', source), operation: 'rewrite', style: 'shorter' });
    expect(run.result.outcome).toBe('applied');
    expect(run.current.summary).toBe(CANDIDATES.en);
    expect(run.incrementCount).toBe(1);
  });

  it('9. Shorter treats normalized equality as the only no-op', async () => {
    const source = CANDIDATES.en;
    const run = await execute({
      cv: makeCv('en', source),
      operation: 'rewrite',
      style: 'shorter',
      candidate: `  ${source.replace(/ /g, '  ')}  `,
    });
    expect(run.result.outcome).toBe('no_op');
    expect(run.usage).toBe(0);
  });

  it('10. Stronger applies a different grounded candidate', async () => {
    const run = await execute({
      cv: makeCv('en', CANDIDATES.en),
      operation: 'rewrite',
      style: 'stronger',
      candidate: 'Customer support specialist who resolves customer requests and maintains accurate order records. Delivers clear communication and reliable daily service.',
    });
    expect(run.result.outcome).toBe('applied');
    expect(run.usage).toBe(1);
  });

  it('11. Stronger exact normalized no-op does not apply', async () => {
    const run = await execute({ cv: makeCv('en', CANDIDATES.en), operation: 'rewrite', style: 'stronger', candidate: CANDIDATES.en });
    expect(run.result.outcome).toBe('no_op');
    expect(run.applyCount).toBe(0);
  });

  it('12. Professional applies a different grounded candidate', async () => {
    const run = await execute({
      cv: makeCv('en', CANDIDATES.en),
      operation: 'rewrite',
      style: 'professional',
      candidate: 'Customer support professional experienced in handling customer requests and maintaining accurate order records. Communicates clearly and provides reliable daily service.',
    });
    expect(run.result.outcome).toBe('applied');
    expect(run.usage).toBe(1);
  });

  it('13. Professional exact normalized no-op does not apply', async () => {
    const run = await execute({ cv: makeCv('en', CANDIDATES.en), operation: 'rewrite', style: 'professional', candidate: CANDIDATES.en });
    expect(run.result.outcome).toBe('no_op');
    expect(run.applyCount).toBe(0);
  });

  it('14. all rewrite styles use the same operation function and differ only by style', async () => {
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      const run = await execute({
        cv: makeCv('en', `${CANDIDATES.en} Extra source sentence.`),
        operation: 'rewrite',
        style,
      });
      expect(run.request).toMatchObject({ operation: 'rewrite', style });
    }
  });

  it('15. stale response cannot overwrite a user-edited Summary', async () => {
    const userEdit = 'User edited this Summary while the provider request was in flight.';
    const run = await execute({
      cv: makeCv('en', CANDIDATES.en),
      operation: 'rewrite',
      style: 'stronger',
      candidate: 'Customer support specialist who resolves requests and maintains accurate records with clear, reliable communication.',
      mutateBeforeReturn: (current) => ({ ...current, summary: userEdit }),
    });
    expect(run.result.outcome).toBe('stale');
    expect(run.current.summary).toBe(userEdit);
    expect(run.applyCount).toBe(0);
  });

  it('16. stale rejection keeps usage unchanged', async () => {
    const run = await execute({
      cv: makeCv('en', CANDIDATES.en),
      operation: 'rewrite',
      style: 'professional',
      candidate: 'Customer support professional who handles customer requests and maintains accurate order records with clear communication and reliable service.',
      mutateBeforeReturn: (current) => ({ ...current, skills: [...current.skills, 'New skill'] }),
    });
    expect(run.result.outcome).toBe('stale');
    expect(run.usage).toBe(0);
  });

  it('17. successful visible apply increments exactly once', async () => {
    const run = await execute({});
    expect(run.applyCount).toBe(1);
    expect(run.incrementCount).toBe(1);
    expect(run.result.diagnostic).toMatchObject({ usageBefore: 0, usageAfter: 1, applied: true });
  });

  it('18. rejected visible apply never increments', async () => {
    const run = await execute({ applyAccepted: false });
    expect(run.result.outcome).toBe('apply_failed');
    expect(run.incrementCount).toBe(0);
  });

  it('19. cv.summary is the content field updated by apply', async () => {
    const source = makeCv();
    const run = await execute({ cv: source });
    expect(run.current.summary).toBe(CANDIDATES.en);
    expect(run.current.personal).toBe(source.personal);
    expect(run.current.experience).toBe(source.experience);
  });

  it('20. legacy Summary metadata cannot override the applied result', async () => {
    const run = await execute({ cv: makeCv() });
    expect(run.current.summary).toBe(CANDIDATES.en);
    expect(run.current.canonicalSummary).toContain('Legacy canonical');
    expect(run.current.summaryGeneratedLocale).toBe('de');
  });

  it('21. routes every supported contentLocale unchanged', async () => {
    const locales = Object.keys(CANDIDATES) as Locale[];
    expect(locales).toHaveLength(12);
    for (const contentLocale of locales) {
      const run = await execute({ cv: makeCv(contentLocale), uiLocale: 'en', candidate: CANDIDATES[contentLocale] });
      expect(run.request.contentLocale).toBe(contentLocale);
      expect(run.result.outcome, contentLocale).toBe('applied');
    }
  });

  it('22. changing uiLocale does not change a fixed contentLocale target', async () => {
    for (const uiLocale of ['en', 'de', 'ar', 'ja'] as const) {
      const run = await execute({ cv: makeCv('sr'), uiLocale, candidate: CANDIDATES.sr });
      expect(run.request.contentLocale).toBe('sr');
    }
  });

  it('23. Arabic, Hindi, and Japanese script gates accept native candidates', () => {
    for (const locale of ['ar', 'hi', 'ja'] as const) {
      const cv = makeCv(locale);
      const result = validateSimpleSummaryCandidate({
        candidate: CANDIDATES[locale],
        contentLocale: locale,
        facts: {
          jobTitle: cv.personal.jobTitle,
          roles: cv.experience.map((entry) => ({
            position: entry.position,
            company: entry.company,
            startDate: entry.startDate,
            endDate: entry.endDate,
            isPresent: entry.isPresent,
            description: entry.description,
          })),
          education: [],
          skills: cv.skills,
          certifications: [],
          languages: [],
        },
      });
      expect(result, locale).toMatchObject({ ok: true });
    }
  });

  it('24. rejects malformed and near-empty provider output', async () => {
    const malformed = await execute({ candidate: { result: CANDIDATES.en } });
    const tiny = await execute({ candidate: 'Experienced worker.' });
    expect(malformed.result.validationFailureReason).toBe('malformed_output');
    expect(tiny.result.validationFailureReason).toBe('empty_or_near_empty');
  });

  it('25. rejects clearly unreasonable Summary length', async () => {
    const run = await execute({ candidate: `Customer support specialist ${'with reliable service '.repeat(100)}` });
    expect(run.result.validationFailureReason).toBe('unreasonable_length');
  });

  it('26. rewrite with an empty current Summary fails safely without provider or usage', async () => {
    const run = await execute({ cv: makeCv('en', ''), operation: 'rewrite', style: 'shorter' });
    expect(run.result.outcome).toBe('source_summary_empty');
    expect(run.request).toBeUndefined();
    expect(run.usage).toBe(0);
  });

  it('27. diagnostics are emitted once and stay compact', async () => {
    const run = await execute({});
    expect(run.diagnostics).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(run.result.diagnostic).length).toBeLessThan(2_000);
  });
});
