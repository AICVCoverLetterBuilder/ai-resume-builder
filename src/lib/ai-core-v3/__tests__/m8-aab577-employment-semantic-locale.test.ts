import { describe, expect, it } from 'vitest';
import {
  createSummaryV3StyleOperationSnapshot,
  type SummaryV3StyleOperationSnapshot,
  type SummaryV3StyleRequest,
  type SummaryV3StyleSupportedLocale,
} from '../summary-style-m5';
import { employmentRelationDecision } from '../summary-style-m5-server';

type LocaleFixture = Readonly<{
  locale: SummaryV3StyleSupportedLocale;
  role: string;
  employer: string;
  present: string;
  completed: string;
  neutral: string;
  completedDuty: string;
  inversePresent: string;
  inverseCompleted: string;
}>;

const FIXTURES: readonly LocaleFixture[] = [
  {
    locale: 'en', role: 'Product Engineer', employer: 'Atlas',
    present: 'I currently work as a Product Engineer at Atlas.',
    completed: 'I formerly worked as a Product Engineer at Atlas.',
    neutral: 'Product Engineer at Atlas delivered reliable APIs.',
    completedDuty: 'I completed installations.',
    inversePresent: 'I currently work at Atlas as a Product Engineer.',
    inverseCompleted: 'I formerly worked at Atlas as a Product Engineer.',
  },
  {
    locale: 'de', role: 'Produktentwicklerin', employer: 'Atlas',
    present: 'Ich arbeite aktuell als Produktentwicklerin bei Atlas.',
    completed: 'Ich arbeitete früher als Produktentwicklerin bei Atlas.',
    neutral: 'Produktentwicklerin bei Atlas entwickelt zuverlässige APIs.',
    completedDuty: 'Ich schloss Installationen ab.',
    inversePresent: 'Ich arbeite aktuell bei Atlas als Produktentwicklerin.',
    inverseCompleted: 'Ich arbeitete früher bei Atlas als Produktentwicklerin.',
  },
  {
    locale: 'sr', role: 'Softverska inženjerka', employer: 'Atlas',
    present: 'Trenutno radim kao Softverska inženjerka u Atlasu.',
    completed: 'Prethodno sam radila kao Softverska inženjerka u Atlasu.',
    neutral: 'Softverska inženjerka u Atlasu izrađuje pouzdane API-je.',
    completedDuty: 'Završila sam instalacije.',
    inversePresent: 'Trenutno radim u Atlasu kao Softverska inženjerka.',
    inverseCompleted: 'Prethodno sam radila u Atlasu kao Softverska inženjerka.',
  },
  {
    locale: 'hr', role: 'Softverska inženjerka', employer: 'Atlas',
    present: 'Trenutno radim kao Softverska inženjerka u Atlasu.',
    completed: 'Prethodno sam radila kao Softverska inženjerka u Atlasu.',
    neutral: 'Softverska inženjerka u Atlasu izrađuje pouzdane API-je.',
    completedDuty: 'Dovršila sam instalacije.',
    inversePresent: 'Trenutno radim u Atlasu kao Softverska inženjerka.',
    inverseCompleted: 'Prethodno sam radila u Atlasu kao Softverska inženjerka.',
  },
  {
    locale: 'hi', role: 'सॉफ्टवेयर इंजीनियर', employer: 'एटलस',
    present: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ।',
    completed: 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर था।',
    neutral: 'एटलस में सॉफ्टवेयर इंजीनियर विश्वसनीय एपीआई बनाता है।',
    completedDuty: 'मैंने इंस्टॉलेशन पूरे किए।',
    inversePresent: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर के रूप में काम करता हूँ।',
    inverseCompleted: 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर के रूप में काम करता था।',
  },
  {
    locale: 'ar', role: 'مهندسة برمجيات', employer: 'أطلس',
    present: 'أعمل حاليا كـمهندسة برمجيات في أطلس.',
    completed: 'عملت سابقا كـمهندسة برمجيات في أطلس.',
    neutral: 'مهندسة برمجيات في أطلس تبني واجهات موثوقة.',
    completedDuty: 'أكملت عمليات التركيب.',
    inversePresent: 'أعمل حاليا في أطلس كـمهندسة برمجيات.',
    inverseCompleted: 'عملت سابقا في أطلس كـمهندسة برمجيات.',
  },
  {
    locale: 'ja', role: 'ソフトウェアエンジニア', employer: 'アトラス',
    present: '現在アトラスのソフトウェアエンジニアとして働いています。',
    completed: '前職ではアトラスのソフトウェアエンジニアとして働いていました。',
    neutral: 'アトラスのソフトウェアエンジニアとして信頼性の高いAPIを構築しました。',
    completedDuty: '作業を完了しました。',
    inversePresent: '現在アトラスでソフトウェアエンジニアとして働いています。',
    inverseCompleted: '前職ではアトラスでソフトウェアエンジニアとして働いていました。',
  },
  {
    locale: 'fr', role: 'Ingénieure logicielle', employer: 'Atlas',
    present: 'Je travaille actuellement comme Ingénieure logicielle chez Atlas.',
    completed: "J'ai auparavant travaillé comme Ingénieure logicielle chez Atlas.",
    neutral: 'Ingénieure logicielle chez Atlas développe des API fiables.',
    completedDuty: "J'ai terminé les installations.",
    inversePresent: 'Je travaille actuellement chez Atlas comme Ingénieure logicielle.',
    inverseCompleted: "J'ai auparavant travaillé chez Atlas comme Ingénieure logicielle.",
  },
  {
    locale: 'es', role: 'Ingeniera de Software', employer: 'Atlas',
    present: 'Actualmente trabajo como Ingeniera de Software en Atlas.',
    completed: 'Anteriormente trabajé como Ingeniera de Software en Atlas.',
    neutral: 'Ingeniera de Software en Atlas desarrolla APIs fiables.',
    completedDuty: 'Completé las instalaciones.',
    inversePresent: 'Actualmente trabajo en Atlas como Ingeniera de Software.',
    inverseCompleted: 'Anteriormente trabajé en Atlas como Ingeniera de Software.',
  },
  {
    locale: 'it', role: 'Ingegnera del Software', employer: 'Atlas',
    present: 'Attualmente lavoro come Ingegnera del Software presso Atlas.',
    completed: 'Prima ho lavorato come Ingegnera del Software presso Atlas.',
    neutral: 'Ingegnera del Software presso Atlas sviluppa API affidabili.',
    completedDuty: 'Ho completato le installazioni.',
    inversePresent: 'Attualmente lavoro presso Atlas come Ingegnera del Software.',
    inverseCompleted: 'Prima ho lavorato presso Atlas come Ingegnera del Software.',
  },
  {
    locale: 'pt-BR', role: 'Engenheira de Software', employer: 'Atlas',
    present: 'Atualmente trabalho como Engenheira de Software em Atlas.',
    completed: 'Anteriormente trabalhei como Engenheira de Software em Atlas.',
    neutral: 'Engenheira de Software em Atlas desenvolve APIs confiáveis.',
    completedDuty: 'Concluí as instalações.',
    inversePresent: 'Atualmente trabalho em Atlas como Engenheira de Software.',
    inverseCompleted: 'Anteriormente trabalhei em Atlas como Engenheira de Software.',
  },
  {
    locale: 'ru', role: 'Инженер-программист', employer: 'Атлас',
    present: 'Сейчас я работаю как Инженер-программист в Атлас.',
    completed: 'Ранее я работал как Инженер-программист в Атлас.',
    neutral: 'Инженер-программист в Атлас разрабатывает надежные API.',
    completedDuty: 'Я завершил установку.',
    inversePresent: 'Сейчас я работаю в Атлас как Инженер-программист.',
    inverseCompleted: 'Ранее я работал в Атлас как Инженер-программист.',
  },
] as const;

const MODIFIER_PREFIXES: Readonly<Record<SummaryV3StyleSupportedLocale, Readonly<{ prior: string; current: string }>>> = {
  en: { prior: 'I previously used another tool, and', current: 'I currently support a side project, and' },
  de: { prior: 'Ich habe zuvor ein anderes Werkzeug verwendet, und', current: 'Ich unterstütze derzeit ein Nebenprojekt, und' },
  sr: { prior: 'Prethodno sam koristila drugi alat, a', current: 'Trenutno podržavam sporedni projekat, a' },
  hr: { prior: 'Prethodno sam koristila drugi alat, a', current: 'Trenutno podržavam sporedni projekt, a' },
  hi: { prior: 'मैंने पहले एक अन्य उपकरण का उपयोग किया, और', current: 'मैं वर्तमान में एक साइड प्रोजेक्ट का समर्थन करती हूँ, और' },
  ar: { prior: 'استخدمت سابقا أداة أخرى، و', current: 'أدعم حاليا مشروعا جانبيا، و' },
  ja: { prior: '以前は別のツールを使い、', current: '現在は別のプロジェクトを支援し、' },
  fr: { prior: "J'ai auparavant utilisé un autre outil, et", current: "Je soutiens actuellement un projet parallèle, et" },
  es: { prior: 'Anteriormente usé otra herramienta, y', current: 'Actualmente apoyo un proyecto paralelo, y' },
  it: { prior: 'In precedenza ho usato un altro strumento, e', current: 'Attualmente supporto un progetto parallelo, e' },
  'pt-BR': { prior: 'Anteriormente usei outra ferramenta, e', current: 'Atualmente apoio um projeto paralelo, e' },
  ru: { prior: 'Ранее я использовал другой инструмент, а', current: 'Сейчас я поддерживаю отдельный проект, а' },
};

function snapshotFor(fixture: LocaleFixture, sourceState: 'present' | 'completed', sourceOverride?: string): SummaryV3StyleOperationSnapshot {
  const source = sourceOverride || (sourceState === 'present' ? fixture.present : fixture.completed);
  const request: SummaryV3StyleRequest = {
    enabled: true,
    operation: 'summary_stronger',
    operationId: `m8-aab577-${fixture.locale}-${sourceState}`,
    style: 'stronger',
    requestedLocale: fixture.locale,
    sourceLocale: fixture.locale,
    visibleSummary: source,
    manifest: {
      manifestId: `m8-aab577-${fixture.locale}-manifest`,
      contextId: `m8-aab577-${fixture.locale}-context`,
      sourceLocale: fixture.locale,
      currentRoleEntryId: sourceState === 'present' ? `entry-${fixture.locale}` : null,
      entries: [{
        stableId: `entry-${fixture.locale}`,
        role: fixture.role,
        employer: fixture.employer,
        roleSourceLocale: fixture.locale,
        employmentState: sourceState,
        durationMonths: 24,
        facts: [{ id: `duty-${fixture.locale}`, text: 'builds reliable APIs' }],
      }],
    },
    createdAt: 1_757_590_100_000 + FIXTURES.indexOf(fixture),
  };
  return createSummaryV3StyleOperationSnapshot(request);
}

function entryDecision(snapshot: SummaryV3StyleOperationSnapshot, candidate: string) {
  return employmentRelationDecision(snapshot, candidate).entries[0]!;
}

describe('M8 AAB577 one-owner employment grammar across supported locales', () => {
  it('audits present, completed, neutral, opposite, and duty-tense states for all 12 locales', () => {
    expect(FIXTURES).toHaveLength(12);
    for (const fixture of FIXTURES) {
      const presentSource = snapshotFor(fixture, 'present');
      const completedSource = snapshotFor(fixture, 'completed');

      expect(entryDecision(presentSource, fixture.present)).toMatchObject({ candidateState: 'present', explicitOpposite: false });
      expect(entryDecision(presentSource, fixture.inversePresent)).toMatchObject({ candidateState: 'present', explicitOpposite: false });
      expect(entryDecision(presentSource, fixture.neutral)).toMatchObject({ candidateState: 'neutral', explicitOpposite: false });
      expect(entryDecision(presentSource, fixture.completed)).toMatchObject({ candidateState: 'completed', explicitOpposite: true });
      expect(entryDecision(presentSource, fixture.inverseCompleted)).toMatchObject({ candidateState: 'completed', explicitOpposite: true });
      expect(entryDecision(presentSource, `${fixture.present} ${fixture.completedDuty}`)).toMatchObject({ candidateState: 'present', explicitOpposite: false });

      expect(entryDecision(completedSource, fixture.completed)).toMatchObject({ candidateState: 'completed', explicitOpposite: false });
      expect(entryDecision(completedSource, fixture.inverseCompleted)).toMatchObject({ candidateState: 'completed', explicitOpposite: false });
      expect(entryDecision(completedSource, fixture.neutral)).toMatchObject({ candidateState: 'neutral', explicitOpposite: false });
      expect(entryDecision(completedSource, fixture.present)).toMatchObject({ candidateState: 'present', explicitOpposite: true });
      expect(entryDecision(completedSource, fixture.inversePresent)).toMatchObject({ candidateState: 'present', explicitOpposite: true });
      expect(entryDecision(presentSource, `${fixture.inversePresent} ${fixture.completedDuty}`)).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    }
  });

  it('preserves the previously supported Hindi, Arabic, and Japanese former surfaces', () => {
    const cases = [
      { fixture: FIXTURES.find((fixture) => fixture.locale === 'hi')!, oldSurface: 'पूर्व', candidate: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ।' },
      { fixture: FIXTURES.find((fixture) => fixture.locale === 'ar')!, oldSurface: 'سابق', candidate: 'أعمل حاليا كـمهندسة برمجيات في أطلس.' },
      { fixture: FIXTURES.find((fixture) => fixture.locale === 'ja')!, oldSurface: '前職', candidate: '現在アトラスのソフトウェアエンジニアとして働いています。' },
      { fixture: FIXTURES.find((fixture) => fixture.locale === 'ja')!, oldSurface: '以前', source: '以前はアトラスのソフトウェアエンジニアとして働いていました。', candidate: '現在アトラスのソフトウェアエンジニアとして働いています。' },
    ] as const;
    for (const item of cases) {
      const completedSource = snapshotFor(item.fixture, 'completed', 'source' in item ? item.source : undefined);
      expect(entryDecision(completedSource, item.fixture.completed)).toMatchObject({ candidateState: 'completed', explicitOpposite: false });
      expect(entryDecision(completedSource, item.candidate)).toMatchObject({ candidateState: 'present', explicitOpposite: true });
    }
  });

  it('keeps neutral source-state loss distinct from explicit contradiction', () => {
    for (const fixture of FIXTURES) {
      const present = entryDecision(snapshotFor(fixture, 'present'), fixture.neutral);
      const completed = entryDecision(snapshotFor(fixture, 'completed'), fixture.neutral);
      expect(present.candidateState).toBe('neutral');
      expect(completed.candidateState).toBe('neutral');
      expect(present.explicitOpposite).toBe(false);
      expect(completed.explicitOpposite).toBe(false);
    }
    const english = FIXTURES.find((fixture) => fixture.locale === 'en')!;
    const source = snapshotFor(english, 'present');
    const unrelated = [
      'I completed a previous project and now work as Product Engineer at Atlas.',
      'A former project required extensive travel; I currently work as Product Engineer at Atlas.',
      'I previously used another tool and currently work as Product Engineer at Atlas.',
      'I currently support a side project and formerly worked as Product Engineer at Atlas.',
    ];
    expect(entryDecision(source, unrelated[0]!)).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(source, unrelated[1]!)).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(source, unrelated[2]!)).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    const completedSource = snapshotFor(english, 'completed');
    const falseGreen = unrelated[3]!;
    const productionDecision = entryDecision(completedSource, falseGreen);
    expect(productionDecision).toMatchObject({ candidateState: 'completed', explicitOpposite: false });
  });

  it('binds temporal modifiers to the selected frame across all 12 locale grammars', () => {
    expect(Object.keys(MODIFIER_PREFIXES)).toHaveLength(12);
    let failures = 0;
    let cases = 0;
    for (const fixture of FIXTURES) {
      const prefixes = MODIFIER_PREFIXES[fixture.locale];
      const currentCandidate = `${prefixes.prior} ${fixture.present}`;
      const completedCandidate = `${prefixes.current} ${fixture.completed}`;
      const currentResult = entryDecision(snapshotFor(fixture, 'present'), currentCandidate);
      const completedResult = entryDecision(snapshotFor(fixture, 'completed'), completedCandidate);
      cases += 2;
      if (currentResult.candidateState !== 'present') failures += 1;
      if (completedResult.candidateState !== 'completed') failures += 1;
      expect(currentResult.candidateState, `${fixture.locale} unrelated prior + current frame`).toBe('present');
      expect(completedResult.candidateState, `${fixture.locale} unrelated current + completed frame`).toBe('completed');
      expect(currentResult.explicitOpposite, `${fixture.locale} current frame contradiction`).toBe(false);
      expect(completedResult.explicitOpposite, `${fixture.locale} completed frame contradiction`).toBe(false);
    }
    expect(cases).toBe(24);
    expect(failures).toBe(0);
  });

  it('keeps employer-first modifier surfaces bound to the selected English frame', () => {
    const fixture = FIXTURES.find((item) => item.locale === 'en')!;
    const present = snapshotFor(fixture, 'present');
    const completed = snapshotFor(fixture, 'completed');
    const cases = [
      { snapshot: present, candidate: 'I currently support a side project and formerly worked at Atlas as Product Engineer.', expected: 'completed' },
      { snapshot: present, candidate: 'I previously used another tool and currently work at Atlas as Product Engineer.', expected: 'present' },
      { snapshot: present, candidate: 'I completed installations and currently work at Atlas as Product Engineer.', expected: 'present' },
      { snapshot: completed, candidate: 'I currently support a side project and formerly worked at Atlas as Product Engineer.', expected: 'completed' },
      { snapshot: completed, candidate: 'I previously used another tool and currently work at Atlas as Product Engineer.', expected: 'present' },
    ] as const;
    let failures = 0;
    for (const item of cases) {
      const result = entryDecision(item.snapshot, item.candidate);
      if (result.candidateState !== item.expected) failures += 1;
      expect(result.candidateState, item.candidate).toBe(item.expected);
      expect(result.explicitOpposite, item.candidate).toBe(
        (item.snapshot.selectedEntries[0]?.employmentState === 'present' && item.expected === 'completed')
          || (item.snapshot.selectedEntries[0]?.employmentState === 'completed' && item.expected === 'present'),
      );
    }
    expect(failures).toBe(0);
  });

  it('retains conflicting only for two explicit states on the selected relation', () => {
    const fixture = FIXTURES.find((item) => item.locale === 'en')!;
    const snapshot = snapshotFor(fixture, 'present');
    const conflicting = entryDecision(snapshot, `${fixture.present} ${fixture.completed}`);
    expect(conflicting.candidateState).toBe('conflicting');
    expect(conflicting.explicitOpposite).toBe(true);

    const unrelatedCurrent = entryDecision(
      snapshotFor(fixture, 'completed'),
      `${fixture.completed} I currently support a side project.`,
    );
    expect(unrelatedCurrent.candidateState).toBe('completed');
    expect(unrelatedCurrent.explicitOpposite).toBe(false);
  });

  it('supports bounded postposed Hindi and Japanese state surfaces through the real owner', () => {
    const hindi = FIXTURES.find((fixture) => fixture.locale === 'hi')!;
    const japanese = FIXTURES.find((fixture) => fixture.locale === 'ja')!;
    const cases = [
      { locale: 'hi' as const, fixture: hindi, sourceState: 'present' as const, text: 'मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ।', expected: 'present' as const, rolePosition: 'after-employer', employerPosition: 'before-role' },
      { locale: 'hi' as const, fixture: hindi, sourceState: 'completed' as const, text: 'मैं एटलस में सॉफ्टवेयर इंजीनियर था।', expected: 'completed' as const, rolePosition: 'after-employer', employerPosition: 'before-role' },
      { locale: 'hi' as const, fixture: hindi, sourceState: 'present' as const, text: 'मैं सॉफ्टवेयर इंजीनियर के रूप में एटलस में काम करता हूँ।', expected: 'present' as const, rolePosition: 'before-employer', employerPosition: 'after-role' },
      { locale: 'hi' as const, fixture: hindi, sourceState: 'completed' as const, text: 'मैं सॉफ्टवेयर इंजीनियर के रूप में एटलस में काम करता था।', expected: 'completed' as const, rolePosition: 'before-employer', employerPosition: 'after-role' },
      { locale: 'ja' as const, fixture: japanese, sourceState: 'present' as const, text: 'アトラスのソフトウェアエンジニアとして働いています。', expected: 'present' as const, rolePosition: 'after-employer', employerPosition: 'before-role' },
      { locale: 'ja' as const, fixture: japanese, sourceState: 'completed' as const, text: 'アトラスのソフトウェアエンジニアとして働いていました。', expected: 'completed' as const, rolePosition: 'after-employer', employerPosition: 'before-role' },
      { locale: 'ja' as const, fixture: japanese, sourceState: 'present' as const, text: 'ソフトウェアエンジニアとしてアトラスで働いています。', expected: 'present' as const, rolePosition: 'before-employer', employerPosition: 'after-role' },
      { locale: 'ja' as const, fixture: japanese, sourceState: 'completed' as const, text: 'ソフトウェアエンジニアとしてアトラスで働いていました。', expected: 'completed' as const, rolePosition: 'before-employer', employerPosition: 'after-role' },
    ] as const;
    let failures = 0;
    for (const item of cases) {
      const result = entryDecision(snapshotFor(item.fixture, item.sourceState, item.text), item.text);
      if (result.candidateState !== item.expected) failures += 1;
      expect(result.candidateState, `${item.locale} ${item.rolePosition} ${item.text}`).toBe(item.expected);
    }
    expect(failures).toBe(0);
  });

  it('keeps postposed state bound to the selected frame and rejects duty-tense lookalikes', () => {
    const hindi = FIXTURES.find((fixture) => fixture.locale === 'hi')!;
    const japanese = FIXTURES.find((fixture) => fixture.locale === 'ja')!;
    const hindiCurrent = snapshotFor(hindi, 'present', 'मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ।');
    const hindiCompleted = snapshotFor(hindi, 'completed', 'मैं एटलस में सॉफ्टवेयर इंजीनियर था।');
    const japaneseCurrent = snapshotFor(japanese, 'present', 'アトラスのソフトウェアエンジニアとして働いています。');
    const japaneseCompleted = snapshotFor(japanese, 'completed', 'アトラスのソフトウェアエンジニアとして働いていました。');

    expect(entryDecision(hindiCurrent, 'एटलस में सॉफ्टवेयर इंजीनियर ने इंस्टॉलेशन पूरे किए।')).toMatchObject({ candidateState: 'neutral', explicitOpposite: false });
    expect(entryDecision(japaneseCurrent, 'アトラスのソフトウェアエンジニアとして構築しました。')).toMatchObject({ candidateState: 'neutral', explicitOpposite: false });
    expect(entryDecision(hindiCurrent, 'मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ। मैंने इंस्टॉलेशन पूरे किए।')).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(japaneseCurrent, 'アトラスのソフトウェアエンジニアとして働いています。作業を完了しました。')).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(hindiCurrent, 'मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ और इंस्टॉलेशन पूरे किए।')).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(japaneseCurrent, 'アトラスのソフトウェアエンジニアとして働いていますが、作業を完了しました。')).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(hindiCurrent, 'मैं एटलस में सॉफ्टवेयर इंजीनियर था।')).toMatchObject({ candidateState: 'completed', explicitOpposite: true });
    expect(entryDecision(japaneseCurrent, 'アトラスのソフトウェアエンジニアとして働いていました。')).toMatchObject({ candidateState: 'completed', explicitOpposite: true });
    expect(entryDecision(hindiCompleted, 'मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ।')).toMatchObject({ candidateState: 'present', explicitOpposite: true });
    expect(entryDecision(japaneseCompleted, 'アトラスのソフトウェアエンジニアとして働いています。')).toMatchObject({ candidateState: 'present', explicitOpposite: true });
  });

  it('does not make agreeing prefix and postposed state surfaces conflicting', () => {
    const hindi = FIXTURES.find((fixture) => fixture.locale === 'hi')!;
    const japanese = FIXTURES.find((fixture) => fixture.locale === 'ja')!;
    expect(entryDecision(snapshotFor(hindi, 'present', 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ।'), 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ।')).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(snapshotFor(japanese, 'present', '現在アトラスのソフトウェアエンジニアとして働いています。'), '現在アトラスのソフトウェアエンジニアとして働いています。')).toMatchObject({ candidateState: 'present', explicitOpposite: false });
    expect(entryDecision(snapshotFor(hindi, 'completed', 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर था।'), 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर था।')).toMatchObject({ candidateState: 'completed', explicitOpposite: false });
    expect(entryDecision(snapshotFor(japanese, 'completed', '前職ではアトラスのソフトウェアエンジニアとして働いていました。'), '前職ではアトラスのソフトウェアエンジニアとして働いていました。')).toMatchObject({ candidateState: 'completed', explicitOpposite: false });
  });

  it('returns conflicting for incompatible same-frame present and completed states', () => {
    const hindi = FIXTURES.find((fixture) => fixture.locale === 'hi')!;
    const japanese = FIXTURES.find((fixture) => fixture.locale === 'ja')!;
    const cases = [
      { fixture: hindi, sourceState: 'present' as const, text: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर था।' },
      { fixture: hindi, sourceState: 'completed' as const, text: 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर हूँ।' },
      { fixture: japanese, sourceState: 'present' as const, text: '現在アトラスのソフトウェアエンジニアとして働いていました。' },
      { fixture: japanese, sourceState: 'completed' as const, text: '前職ではアトラスのソフトウェアエンジニアとして働いています。' },
    ] as const;
    let falseNegatives = 0;
    for (const item of cases) {
      const result = entryDecision(snapshotFor(item.fixture, item.sourceState, item.text), item.text);
      if (result.candidateState !== 'conflicting') falseNegatives += 1;
      expect(result.candidateState, item.text).toBe('conflicting');
    }
    expect(falseNegatives).toBe(0);
  });

  it('covers the Hindi and Japanese same-frame state matrix with an independent oracle', () => {
    const hindi = FIXTURES.find((fixture) => fixture.locale === 'hi')!;
    const japanese = FIXTURES.find((fixture) => fixture.locale === 'ja')!;
    const cases = [
      { fixture: hindi, sourceState: 'present' as const, text: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ।', expected: 'present' as const },
      { fixture: hindi, sourceState: 'completed' as const, text: 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर था।', expected: 'completed' as const },
      { fixture: hindi, sourceState: 'present' as const, text: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर था।', expected: 'conflicting' as const },
      { fixture: hindi, sourceState: 'completed' as const, text: 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर हूँ।', expected: 'conflicting' as const },
      { fixture: hindi, sourceState: 'present' as const, text: 'मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ।', expected: 'present' as const },
      { fixture: hindi, sourceState: 'completed' as const, text: 'मैं एटलस में सॉफ्टवेयर इंजीनियर था।', expected: 'completed' as const },
      { fixture: hindi, sourceState: 'present' as const, text: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ। मैंने इंस्टॉलेशन पूरे किए।', expected: 'present' as const },
      { fixture: hindi, sourceState: 'completed' as const, text: 'मैं पूर्व में एटलस में सॉफ्टवेयर इंजीनियर था। मैं एक साइड प्रोजेक्ट का समर्थन करता हूँ।', expected: 'completed' as const },
      { fixture: japanese, sourceState: 'present' as const, text: '現在アトラスのソフトウェアエンジニアとして働いています。', expected: 'present' as const },
      { fixture: japanese, sourceState: 'completed' as const, text: '前職ではアトラスのソフトウェアエンジニアとして働いていました。', expected: 'completed' as const },
      { fixture: japanese, sourceState: 'present' as const, text: '現在アトラスのソフトウェアエンジニアとして働いていました。', expected: 'conflicting' as const },
      { fixture: japanese, sourceState: 'completed' as const, text: '前職ではアトラスのソフトウェアエンジニアとして働いています。', expected: 'conflicting' as const },
      { fixture: japanese, sourceState: 'present' as const, text: 'アトラスのソフトウェアエンジニアとして働いています。', expected: 'present' as const },
      { fixture: japanese, sourceState: 'completed' as const, text: 'アトラスのソフトウェアエンジニアとして働いていました。', expected: 'completed' as const },
      { fixture: japanese, sourceState: 'present' as const, text: '現在アトラスのソフトウェアエンジニアとして働いています。作業を完了しました。', expected: 'present' as const },
      { fixture: japanese, sourceState: 'completed' as const, text: '前職ではアトラスのソフトウェアエンジニアとして働いていました。現在は別のプロジェクトを支援しています。', expected: 'completed' as const },
    ] as const;
    let failures = 0;
    for (const item of cases) {
      const result = entryDecision(snapshotFor(item.fixture, item.sourceState, item.text), item.text);
      if (result.candidateState !== item.expected) failures += 1;
      expect(result.candidateState, item.text).toBe(item.expected);
    }
    expect(cases).toHaveLength(16);
    expect(failures).toBe(0);
  });
});
