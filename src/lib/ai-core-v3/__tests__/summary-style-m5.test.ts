import { describe, expect, it } from 'vitest';
import {
  canonicalSummaryV3StyleLocale,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  createSummaryV3StyleOperationSnapshot,
  decideSummaryV3StyleOwnership,
  hashSummaryV3StyleValue,
  normalizedSummaryV3StyleLength,
  inspectSummaryV3StyleCandidatePreservesLocks,
  summaryV3StyleCandidatePreservesLocks,
  summaryV3StyleCalendarDateRanges,
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
  summaryV3StyleFactAnchorTokens,
  summaryV3StyleHasReservedTransportMetadataPrefix,
  summaryV3StyleIsMarkdownOrList,
  summaryV3StyleLocaleContentMatches,
  summaryV3StyleLocaleSurfaceMatches,
  SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL,
  type SummaryV3Style,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';

const visible = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';

const localeEmploymentFixtures = [
  { locale: 'en', source: 'Mila is a Product Engineer at Nova for 24 months.', role: 'Product Engineer', employer: 'Nova', fact: 'builds reliable APIs', priorRole: 'Analyst', priorEmployer: 'Orbit', priorFact: 'reviewed reports' },
  { locale: 'de', source: 'Mila ist Produktentwicklerin bei Nova seit 24 Monaten.', role: 'Produktentwicklerin', employer: 'Nova', fact: 'entwickelt zuverlässige APIs', priorRole: 'Analystin', priorEmployer: 'Orbit', priorFact: 'prüfte Berichte' },
  { locale: 'sr', source: 'Mila je softverska inženjerka u Novi već 24 meseca.', role: 'Softverska inženjerka', employer: 'Nova', fact: 'izrađuje pouzdane API-je', priorRole: 'Analitičarka', priorEmployer: 'Orbit', priorFact: 'pregledala izveštaje' },
  { locale: 'hi', source: 'मीरा नोवा में सॉफ्टवेयर इंजीनियर हैं और 24 महीनों से काम करती हैं।', role: 'सॉफ्टवेयर इंजीनियर', employer: 'नोवा', fact: 'विश्वसनीय एपीआई बनाती हैं', priorRole: 'विश्लेषक', priorEmployer: 'ऑर्बिट', priorFact: 'रिपोर्ट की समीक्षा की' },
  { locale: 'ar', source: 'ميرا مهندسة برمجيات في نوفا منذ 24 شهرا.', role: 'مهندسة برمجيات', employer: 'نوفا', fact: 'تبني واجهات برمجة موثوقة', priorRole: 'محللة', priorEmployer: 'أوربت', priorFact: 'راجعت التقارير' },
  { locale: 'ja', source: 'ミラはノヴァのソフトウェアエンジニアとして24か月勤務しています。', role: 'ソフトウェアエンジニア', employer: 'ノヴァ', fact: '信頼性の高いAPIを構築', priorRole: 'アナリスト', priorEmployer: 'オービット', priorFact: 'レポートを確認' },
] as const;

const runtimeLocaleCases = [
  { locale: 'en', aliases: ['en', 'en-US', 'en_GB'], scriptSample: 'Professional summary with clear reliable experience.' },
  { locale: 'de', aliases: ['de', 'de-DE'], scriptSample: 'Professionelle Zusammenfassung mit klarer Erfahrung.' },
  { locale: 'sr', aliases: ['sr', 'sr-Latn-RS', 'sr-Cyrl-RS'], scriptSample: 'Јасно професионално искуство.' },
  { locale: 'hi', aliases: ['hi', 'hi-IN'], scriptSample: 'स्पष्ट पेशेवर अनुभव।' },
  { locale: 'ar', aliases: ['ar', 'ar-SA'], scriptSample: 'خبرة مهنية واضحة.' },
  { locale: 'ja', aliases: ['ja', 'ja-JP'], scriptSample: '明確な職務経験。' },
  { locale: 'fr', aliases: ['fr', 'fr-FR'], scriptSample: 'Résumé professionnel clair et fiable.' },
  { locale: 'es', aliases: ['es', 'es-ES', 'es-MX'], scriptSample: 'Resumen profesional claro y fiable.' },
  { locale: 'it', aliases: ['it', 'it-IT'], scriptSample: 'Profilo professionale chiaro e affidabile.' },
  { locale: 'hr', aliases: ['hr', 'hr-HR'], scriptSample: 'Jasan i pouzdan profesionalni sažetak.' },
  { locale: 'pt-BR', aliases: ['pt-BR', 'pt_BR', 'PT-br'], scriptSample: 'Resumo profissional claro e confiável.' },
  { locale: 'ru', aliases: ['ru', 'ru-RU'], scriptSample: 'Чёткий профессиональный опыт.' },
] as const;

function requestFor(style: SummaryV3Style, overrides: Partial<SummaryV3StyleRequest> = {}): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: `summary_${style}`,
    operationId: `m5-${style}-001`,
    style,
    requestedLocale: 'en-US',
    sourceLocale: 'en',
    visibleSummary: visible,
    protectedEntities: ['Ava Patel'],
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' },
      { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' },
      { id: 'duty-api', text: 'builds reliable APIs' },
      { id: 'duty-mentor', text: 'mentors peers' },
      { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' },
    ],
    manifest: {
      manifestId: 'manifest-001',
      contextId: 'context-001',
      sourceLocale: 'en',
      currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current',
        role: 'Product Engineer',
        employer: 'Atlas',
        employmentState: 'present',
        durationMonths: 24,
        facts: [
          { id: 'duty-api', text: 'builds reliable APIs' },
          { id: 'duty-mentor', text: 'mentors peers' },
          { id: 'metric', text: 'improved delivery by 20%' },
          { id: 'context-only-tool', text: 'Kubernetes' },
        ],
      }],
    },
    requestIdentity: 'request-001',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('M5 Summary style ownership and source contract', () => {
  it.each(['shorter', 'stronger', 'professional'] as const)('owns exact same-locale %s operations', (style) => {
    expect(decideSummaryV3StyleOwnership(requestFor(style))).toMatchObject({ kind: 'owned', style, requestedLocale: 'en' });
  });

  it('does not own M4, Experience, unsupported, disabled, or cross-locale operations', () => {
    expect(decideSummaryV3StyleOwnership({ ...requestFor('shorter'), operation: 'summary_generate' })).toEqual({ kind: 'not_applicable', reason: 'm4_generate_owned_elsewhere' });
    expect(decideSummaryV3StyleOwnership({ ...requestFor('shorter'), operation: 'experience_enhance' })).toEqual({ kind: 'not_applicable', reason: 'experience_owned_elsewhere' });
    expect(decideSummaryV3StyleOwnership({ ...requestFor('shorter'), style: 'translate' })).toEqual({ kind: 'not_applicable', reason: 'unsupported_style' });
    expect(decideSummaryV3StyleOwnership({ ...requestFor('shorter'), enabled: false })).toEqual({ kind: 'not_applicable', reason: 'feature_not_enabled' });
    expect(decideSummaryV3StyleOwnership({ ...requestFor('shorter'), requestedLocale: 'de', sourceLocale: 'en' })).toEqual({ kind: 'not_applicable', reason: 'cross_locale' });
  });

  it('accepts canonical same-locale spelling without treating a different locale as same-locale', () => {
    expect(canonicalSummaryV3StyleLocale('EN_us')).toBe('en');
    expect(canonicalSummaryV3StyleLocale('sr-Latn-RS')).toBe('sr');
    expect(canonicalSummaryV3StyleLocale('pt-BR')).toBe('pt-BR');
    expect(decideSummaryV3StyleOwnership({ ...requestFor('professional'), requestedLocale: 'en_GB', sourceLocale: 'en-US' }).kind).toBe('owned');
  });

  it.each(runtimeLocaleCases)('canonicalizes every supported runtime locale without collapsing pt-BR', ({ locale, aliases }) => {
    for (const alias of aliases) expect(canonicalSummaryV3StyleLocale(alias)).toBe(locale);
    expect(SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES).toContain(locale);
    expect(canonicalSummaryV3StyleLocale('pt-PT')).toBeNull();
  });

  it.each(runtimeLocaleCases)('owns same-locale %s style requests across the complete runtime contract', ({ locale }) => {
    expect(decideSummaryV3StyleOwnership({
      ...requestFor('professional'),
      requestedLocale: locale,
      sourceLocale: locale,
    })).toEqual({ kind: 'owned', style: 'professional', requestedLocale: locale });
  });

  it.each([
    ['en', 'de'], ['fr', 'es'], ['hr', 'sr'], ['pt-BR', 'es'], ['ru', 'sr'],
  ] as const)('keeps %s to %s cross-locale requests outside M5', (requestedLocale, sourceLocale) => {
    expect(decideSummaryV3StyleOwnership({ ...requestFor('shorter'), requestedLocale, sourceLocale })).toEqual({ kind: 'not_applicable', reason: 'cross_locale' });
  });

  it.each(['pl', 'nl', 'zh'] as const)('keeps unsupported %s outside M5', (locale) => {
    expect(decideSummaryV3StyleOwnership({ ...requestFor('shorter'), requestedLocale: locale, sourceLocale: locale })).toEqual({ kind: 'not_applicable', reason: 'unsupported_locale' });
  });

  it.each(runtimeLocaleCases)('uses only the compact script-family floor for %s', ({ locale, scriptSample }) => {
    expect(summaryV3StyleLocaleSurfaceMatches(scriptSample, locale)).toBe(true);
    expect(summaryV3StyleLocaleContentMatches(scriptSample, locale)).toBe(true);
  });

  it('requires Cyrillic for Russian while keeping Latin-only prose outside the Russian floor', () => {
    expect(summaryV3StyleLocaleSurfaceMatches('Чёткий профессиональный опыт.', 'ru')).toBe(true);
    expect(summaryV3StyleLocaleSurfaceMatches('Clear professional experience.', 'ru')).toBe(false);
  });

  it('publishes all twelve canonical locales in both forced writer and evaluator locale schemas', () => {
    const writerLocale = SUMMARY_V3_STYLE_M5_WRITER_TOOL.input_schema.properties.locale;
    const evaluatorLocale = SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL.input_schema.properties.locale;
    expect(writerLocale.enum).toEqual([...SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES]);
    expect(evaluatorLocale.enum).toEqual([...SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES]);
  });

  it('makes the exact visible Summary the non-empty transformation floor and excludes context-only facts', () => {
    const snapshot = createSummaryV3StyleOperationSnapshot(requestFor('professional'));
    expect(snapshot.mode).toBe('enhance_existing_content');
    expect(snapshot.sourceKind).toBe('visible_summary');
    expect(snapshot.sourceSummaryHash).toBe(hashSummaryV3StyleValue(visible));
    expect(snapshot.requiredFacts.map((fact) => fact.id)).not.toContain('context-only-tool');
    expect(snapshot.entityLocks.map((lock) => lock.value)).toEqual(expect.arrayContaining(['Ava Patel', 'Product Engineer', 'Atlas', '24']));
    expect(snapshot.sourceUnits.every((unit) => /^m5_[0-9a-f]{8}$/u.test(unit.id))).toBe(true);
    expect(snapshot.sourceUnits.every((unit) => !/^source-unit-\d+$/u.test(unit.id))).toBe(true);
  });

  it('derives an exact source-unit floor even when a future page supplies no optional annotations', () => {
    const automaticFloor = createSummaryV3StyleOperationSnapshot({ ...requestFor('shorter'), visibleSummaryFacts: undefined });
    expect(automaticFloor.requiredFacts.map((fact) => fact.id)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^visible:m5_[0-9a-f]{8}$/u),
    ]));
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'),
      visibleSummaryFacts: [{ id: 'absent', text: 'Kubernetes' }],
    })).toThrow(/visible source fact/u);
    expect(() => createSummaryV3StyleOperationSnapshot({ ...requestFor('shorter'), protectedEntities: ['Not Present'] })).toThrow(/protected entity/u);
  });

  it.each(['shorter', 'stronger', 'professional'] as const)('uses immutable manifest facts for an empty %s operation', (style) => {
    const snapshot = createSummaryV3StyleOperationSnapshot({ ...requestFor(style), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined });
    expect(snapshot.mode).toBe('generate_from_context');
    expect(snapshot.sourceKind).toBe('context_manifest');
    expect(snapshot.requiredFacts.map((fact) => fact.id)).toContain('context-only-tool');
    expect(snapshot.requiredFacts.length).toBeGreaterThan(4);
  });

  it('fails closed after ownership when an empty source has no unambiguous current role', () => {
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'),
      visibleSummary: '',
      visibleSummaryFacts: undefined,
      manifest: { ...requestFor('shorter').manifest, currentRoleEntryId: null },
    })).toThrow(/empty source requires/u);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'),
      visibleSummary: '',
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...requestFor('shorter').manifest,
        entries: [{ ...requestFor('shorter').manifest.entries[0]!, employmentState: 'completed' }],
      },
    })).toThrow(/current role must be present/u);
  });

  it('deeply freezes snapshot records and does not use raw text in identity evidence fields', () => {
    const request = requestFor('stronger');
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.requiredFacts)).toBe(true);
    expect(Object.isFrozen(snapshot.requiredFacts[0])).toBe(true);
    expect(Object.isFrozen(snapshot.entityLocks)).toBe(true);
    expect(Object.isFrozen(snapshot.selectedEntries)).toBe(true);
    expect(Object.isFrozen(snapshot.selectedEntries[0])).toBe(true);
    expect(Object.isFrozen(snapshot.manifestFacts)).toBe(true);
    expect(Object.isFrozen(snapshot.manifestFacts[0])).toBe(true);
    expect(Object.isFrozen(snapshot.sourceUnits)).toBe(true);
    expect(Object.isFrozen(snapshot.sourceUnits[0])).toBe(true);
    expect(snapshot.snapshotHash).toMatch(/^m5_[0-9a-f]{8}$/u);
    expect(snapshot.requiredFacts[0].hash).toMatch(/^m5_[0-9a-f]{8}$/u);
    const mutableManifest = request.manifest as unknown as { entries: Array<{ facts: Array<{ text: string }> }> };
    mutableManifest.entries[0]!.facts[0]!.text = 'mutated only after snapshot construction';
    expect(snapshot.snapshotHash).toMatch(/^m5_[0-9a-f]{8}$/u);
    expect(snapshot.manifestFacts[4]?.text).not.toBe('mutated only after snapshot construction');
  });

  it('derives immutable clause-local entity bindings for explicitly protected multi-person source facts', () => {
    const snapshot = createSummaryV3StyleOperationSnapshot({
      ...requestFor('professional'),
      visibleSummary: 'Ava builds APIs at Atlas, while Ben mentors peers at Nova.',
      visibleSummaryFacts: undefined,
      protectedEntities: ['Ava', 'Ben'],
      manifest: {
        manifestId: 'relation-manifest', contextId: 'relation-context', sourceLocale: 'en', currentRoleEntryId: 'ava-entry',
        entries: [
          { stableId: 'ava-entry', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'ava-duty', text: 'builds APIs' }] },
          { stableId: 'ben-entry', role: 'Mentor', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'ben-duty', text: 'mentors peers' }] },
        ],
      },
    });
    expect(snapshot.entityRelationBindings).toHaveLength(2);
    expect(Object.isFrozen(snapshot.entityRelationBindings)).toBe(true);
    expect(Object.isFrozen(snapshot.entityRelationBindings[0])).toBe(true);
    expect(snapshot.entityRelationBindings.every((binding) => binding.sourceFactHashes.length > 0)).toBe(true);
  });

  it('derives automatic multi-person entity bindings when optional page annotations are absent', () => {
    const snapshot = createSummaryV3StyleOperationSnapshot({
      ...requestFor('professional'),
      visibleSummary: 'Ava builds APIs at Atlas. Ben mentors peers at Nova.',
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'auto-relation-manifest', contextId: 'auto-relation-context', sourceLocale: 'en', currentRoleEntryId: 'ava-entry',
        entries: [
          { stableId: 'ava-entry', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'ava-duty', text: 'builds APIs' }] },
          { stableId: 'ben-entry', role: 'Mentor', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'ben-duty', text: 'mentors peers' }] },
        ],
      },
    });
    expect(snapshot.entityLocks.filter((lock) => lock.kind === 'entity').map((lock) => lock.value)).toEqual(expect.arrayContaining(['Ava', 'Ben']));
    expect(snapshot.entityRelationBindings).toHaveLength(2);
  });

  it('requires an explicit compact protected entity as an exact surface rather than a larger-name substring', () => {
    const snapshot = createSummaryV3StyleOperationSnapshot({
      ...requestFor('professional'),
      visibleSummary: 'Li builds APIs at Atlas for 24 months.',
      visibleSummaryFacts: undefined,
      protectedEntities: ['Li'],
      manifest: {
        manifestId: 'compact-entity-manifest', contextId: 'compact-entity-context', sourceLocale: 'en', currentRoleEntryId: 'compact-entry',
        entries: [{ stableId: 'compact-entry', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'compact-duty', text: 'builds APIs' }] }],
      },
    });
    expect(summaryV3StyleCandidatePreservesLocks(snapshot, 'Lina builds APIs at Atlas for 24 months.')).toBe(false);
    expect(summaryV3StyleCandidatePreservesLocks(snapshot, 'Li builds APIs at Atlas for 24 months.')).toBe(true);
  });

  it('reports finite source-lock reasons with boolean parity across identity and duration branches', () => {
    const snapshot = createSummaryV3StyleOperationSnapshot({
      ...requestFor('stronger'),
      visibleSummary: 'Li is Engineer at Atlas for 24 months.',
      protectedEntities: ['Li'],
      visibleSummaryFacts: undefined,
      manifest: {
        ...requestFor('stronger').manifest,
        entries: [{
          stableId: 'entry-current',
          role: 'Engineer',
          employer: 'Atlas',
          employmentState: 'present',
          durationMonths: 24,
          facts: [{ id: 'duty-api', text: 'builds APIs' }],
        }],
      },
    });
    const terminalSnapshot = createSummaryV3StyleOperationSnapshot({
      ...requestFor('stronger'),
      visibleSummary: 'Li.',
      protectedEntities: ['Li'],
      visibleSummaryFacts: undefined,
    });
    const cases = [
      [snapshot, 'Li is Engineer at Atlas for 24 months.', null],
      [snapshot, 'Lina is Engineer at Atlas for 24 months.', 'identity_surface_missing'],
      [snapshot, 'Li Priya is Engineer at Atlas for 24 months.', 'identity_unattested_suffix'],
      [snapshot, 'Brilliant Li is Engineer at Atlas for 24 months.', 'identity_unattested_prefix'],
      [terminalSnapshot, 'Li Priya.', 'identity_unattested_terminal_extension'],
      [snapshot, 'Li is Engineer at Atlas for 12 months.', 'duration_surface_missing'],
    ] as const;
    for (const [caseSnapshot, candidate, reason] of cases) {
      const inspection = inspectSummaryV3StyleCandidatePreservesLocks(caseSnapshot, candidate);
      expect(inspection.preserved).toBe(summaryV3StyleCandidatePreservesLocks(caseSnapshot, candidate));
      if (reason) {
        expect(inspection).toMatchObject({ preserved: false, failureReason: reason });
        expect(inspection.failureKind).toBeTruthy();
        expect(inspection.failedIndex).toEqual(expect.any(Number));
      } else {
        expect(inspection).toEqual({ preserved: true, failureKind: null, failureReason: null, failedIndex: null });
      }
    }
    expect(inspectSummaryV3StyleCandidatePreservesLocks(snapshot, 'Li is Engineer at Atlas for 24 months.').failureKind).toBeNull();
    expect(inspectSummaryV3StyleCandidatePreservesLocks(snapshot, 'Li at Atlas for 24 months.')).toMatchObject({ failureKind: 'role' });
    expect(inspectSummaryV3StyleCandidatePreservesLocks(snapshot, 'Li is Engineer for 24 months.')).toMatchObject({ failureKind: 'employer' });
    expect(inspectSummaryV3StyleCandidatePreservesLocks(snapshot, 'Li is Engineer at Atlas.')).toMatchObject({ failureKind: 'duration' });
    expect(inspectSummaryV3StyleCandidatePreservesLocks(snapshot, 'Lina is Engineer at Atlas for 24 months.')).toMatchObject({ failureKind: 'entity' });
    const generatedSnapshot = createSummaryV3StyleOperationSnapshot({
      ...requestFor('stronger'),
      visibleSummary: '',
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    });
    expect(inspectSummaryV3StyleCandidatePreservesLocks(generatedSnapshot, 'Atlasu')).toEqual({
      preserved: true, failureKind: null, failureReason: null, failedIndex: null,
    });
  });

  it('binds request time, current-role identity, and entity locks into distinct immutable snapshot identities', () => {
    const baseline = createSummaryV3StyleOperationSnapshot(requestFor('professional'));
    const changedTime = createSummaryV3StyleOperationSnapshot({ ...requestFor('professional'), createdAt: 1_700_000_000_001 });
    const changedLock = createSummaryV3StyleOperationSnapshot({ ...requestFor('professional'), protectedEntities: ['Ava Patel', 'Atlas'] });
    const changedCurrentRole = createSummaryV3StyleOperationSnapshot({
      ...requestFor('professional'),
      manifest: {
        ...requestFor('professional').manifest,
        currentRoleEntryId: 'entry-prior',
        entries: [
          ...requestFor('professional').manifest.entries,
          { stableId: 'entry-prior', role: 'Analyst', employer: 'Nova', employmentState: 'present', durationMonths: 12, facts: [{ id: 'prior-duty', text: 'reviewed reports' }] },
        ],
      },
    });
    expect(changedTime.snapshotHash).not.toBe(baseline.snapshotHash);
    expect(changedLock.snapshotHash).not.toBe(baseline.snapshotHash);
    expect(changedCurrentRole.snapshotHash).not.toBe(baseline.snapshotHash);
    expect(changedCurrentRole.currentRoleEntryId).toBe('entry-prior');
  });

  it('requires the page owner to explicitly supply a string source and rejects a clear claimed-locale/content mismatch', () => {
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'), visibleSummary: undefined as unknown as string,
    })).toThrow(/explicitly supplied/u);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'),
      requestedLocale: 'de', sourceLocale: 'de', manifest: { ...requestFor('shorter').manifest, sourceLocale: 'de' },
    })).toThrow(/claimed source locale/u);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'), requestIdentity: '' as unknown as string,
    })).toThrow(/requestIdentity/u);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'), enabled: 'yes' as unknown as boolean,
    })).toThrow(/enabled must be boolean/u);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...requestFor('shorter'), visibleSummary: '   ', visibleSummaryFacts: undefined,
    })).toThrow(/exactly empty/u);
  });

  it('keeps the single explicit Stronger predicate exception identity-bound and rejects unsafe marker shapes', () => {
    const markerSource = 'Mira is an Engineer at Atlas. Mira builds reliable APIs for 24 months.';
    const base = requestFor('stronger', {
      visibleSummary: markerSource,
      protectedEntities: ['Mira'],
      visibleSummaryFacts: [{
        id: 'marked-duty', text: 'Mira builds reliable APIs', semanticKind: 'duty',
        transformableDuty: { sourcePredicate: 'builds', predicateAnchor: 'builds' },
      }],
      manifest: {
        manifestId: 'marked-manifest', contextId: 'marked-context', sourceLocale: 'en', currentRoleEntryId: 'current',
        entries: [{ stableId: 'current', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'Mira builds reliable APIs' }] }],
      },
    });
    const marked = createSummaryV3StyleOperationSnapshot(base);
    const unmarked = createSummaryV3StyleOperationSnapshot({ ...base, visibleSummaryFacts: undefined });
    expect(marked.transformableDuty).toMatchObject({ sourceFactId: 'marked-duty', sourcePredicate: 'builds', predicateAnchor: 'builds' });
    expect(Object.isFrozen(marked.transformableDuty)).toBe(true);
    expect(marked.snapshotHash).not.toBe(unmarked.snapshotHash);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...base,
      visibleSummaryFacts: [{
        id: 'tool-marker', text: 'Mira builds reliable APIs', semanticKind: 'tool',
        transformableDuty: { sourcePredicate: 'builds', predicateAnchor: 'builds' },
      }],
    })).toThrow(/visible duty fact/u);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...base,
      visibleSummaryFacts: [{
        id: 'numeric-marker', text: 'Mira builds reliable APIs for 24 months', semanticKind: 'duty',
        transformableDuty: { sourcePredicate: '24 months', predicateAnchor: '24' },
      }],
    })).toThrow(/nonnumeric predicate anchor/u);
    expect(() => createSummaryV3StyleOperationSnapshot({
      ...base,
      visibleSummary: 'Mira is an Engineer at Atlas. Mira uses Python for 24 months.',
      visibleSummaryFacts: [{
        id: 'tool-shaped-marker', text: 'Mira uses Python', semanticKind: 'duty',
        transformableDuty: { sourcePredicate: 'uses Python', predicateAnchor: 'Python' },
      }],
      manifest: {
        ...base.manifest,
        entries: [{
          ...base.manifest.entries[0]!,
          facts: [{ id: 'tool-shaped-marker', text: 'Mira uses Python' }],
        }],
      },
    })).toThrow(/permitted grounded duty token/u);
  });

  it('exports an exact per-style closed evaluator evidence schema rather than an open object', () => {
    const styleEvidence = SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL.input_schema.properties.styleEvidence;
    expect(styleEvidence).toMatchObject({ oneOf: expect.any(Array) });
    expect(styleEvidence.oneOf).toHaveLength(3);
    for (const branch of styleEvidence.oneOf) {
      expect(branch).toMatchObject({ type: 'object', additionalProperties: false });
      expect(branch.required).toContain('style');
    }
  });

  it('protects compact non-Latin leading names without treating English filler as a material anchor', () => {
    expect(summaryV3StyleFactAnchorTokens('A Product Engineer at Atlas.')).not.toContain('a');
    expect(summaryV3StyleFactAnchorTokens('ミラはエンジニアです。')).toContain('ミラ');
    expect(summaryV3StyleFactAnchorTokens('لو مهندس في نوفا.')).toContain('لو');
    expect(summaryV3StyleFactAnchorTokens('20 % over 24 months with C#, Node.js, and $20.')).toEqual(expect.arrayContaining(['span:20%', 'span:24 months', 'span:c#', 'span:node.js', 'span:$20']));
    expect(summaryV3StyleFactAnchorTokens('24か月勤務しました。')).toContain('span:24か月');
  });

  it('reserves protocol metadata only at a unit or clause boundary, not in ordinary prose', () => {
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('A professional style: clear, grounded language.')).toBe(false);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava applies validation: careful source checks before revision.')).toBe(false);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs. Operation ID: audit-001')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs; Operation ID — audit-001')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs — Operation ID — audit-001')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs; Validation passed.')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs {"operationId":"audit-001"}')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs; toolName: submit_summary_style_candidate')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs; contentBlockCount: 1')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs; candidateHash: m5_test')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs (Operation ID: audit-001).')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs [Operation ID = audit-001].')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs (candidateHash: m5_test).')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs “Operation ID: audit-001”.')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs / Operation ID: audit-001')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs ({"operationId":"audit-001"}).')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs [{"candidateHash":"m5_test"}].')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs (for trusted teams).')).toBe(false);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs; input: {}')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs [{"toolName":"submit_summary_style_candidate"}]')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs. Operation ID, audit-001')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs. Operation ID\taudit-001')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs. operationId/audit-001')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs.\nOperation ID: audit-001')).toBe(true);
  });

  it('rejects bounded summary headings and explanatory preambles without rejecting ordinary colon prose', () => {
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary — Product Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Summary = Product Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Here is your summary: Product Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Zusammenfassung: Produktentwicklerin bei Atlas entwickelt zuverlässige APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Hier ist Ihre Zusammenfassung: Produktentwicklerin bei Atlas entwickelt zuverlässige APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Sažetak: Inženjerka u Atlasu izrađuje pouzdane API-je.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Evo vašeg sažetka: Inženjerka u Atlasu izrađuje pouzdane API-je.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('सारांश: एटलस में इंजीनियर विश्वसनीय एपीआई बनाती हैं।')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('यह आपका सारांश है: एटलस में इंजीनियर विश्वसनीय एपीआई बनाती हैं।')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('ملخص: مهندسة في أطلس تبني واجهات برمجة موثوقة.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('هذا ملخصك: مهندسة في أطلس تبني واجهات برمجة موثوقة.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('職務要約: アトラスのエンジニアが信頼性の高いAPIを構築します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('以下が要約です: アトラスのエンジニアが信頼性の高いAPIを構築します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Zusammenfassung\nProduktentwicklerin bei Atlas entwickelt zuverlässige APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('要約\nアトラスのエンジニアが信頼性の高いAPIを構築します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Updated summary: Product Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Career Profile\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Bio\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Revised CV Summary:\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('A summary of qualifications\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Career at a glance\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('A record of impact\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Core Competencies\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Key Contributions\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('key skills\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('major achievements\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('relevant experience\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('personal statement\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('project overview\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('client achievements\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('role overview\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('an internal client project overview:\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('professional strengths\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('主な成果\nミラはアトラスのエンジニアとしてAPIを構築します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('経歴\nミラはアトラスのエンジニアとしてAPIを構築します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('プロジェクト概要\nミラはアトラスのエンジニアとしてAPIを構築します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('المهارات الأساسية\nميرا مهندسة في أطلس وتبني واجهات برمجة موثوقة.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('المشاريع\nميرا مهندسة في أطلس وتبني واجهات برمجة موثوقة.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('मुख्य कौशल\nमीरा एटलस में इंजीनियर हैं और विश्वसनीय एपीआई बनाती हैं।')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('परियोजनाएं\nमीरा एटलस में इंजीनियर हैं और विश्वसनीय एपीआई बनाती हैं।')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava explains: she builds reliable APIs at Atlas.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs at Atlas\nand mentors engineers across teams.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs at Atlas.\nShe mentors engineers across teams.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava Patel\nis a Product Engineer at Atlas who builds reliable APIs.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava is a Product Engineer at Atlas who works with\nKubernetes to build reliable APIs.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('ミラはアトラスのエンジニアとして\nAPIを構築します。')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('ميرا مهندسة في أطلس\nوتبني واجهات برمجة موثوقة.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('मीरा एटलस में इंजीनियर हैं\nऔर विश्वसनीय एपीआई बनाती हैं।')).toBe(false);
  });

  it('rejects non-prose markup, raw structured fragments, and unhandled Markdown without rejecting an ordinary angle comparison', () => {
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n~~~\naudit\n~~~')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('+ Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('> Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n---\naudit')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n| Field | Value |\n| --- | --- |\n| status | audit |')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds ~~reliable~~ APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds [reliable APIs][source].')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('![audit][source]')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n___\naudit')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n***\naudit')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary\n====')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n[^note]: audit')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs[^note].')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds (**reliable**) APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds(_reliable_) APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava:*reliable* APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava,*reliable* APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('“*reliable*” APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava—*reliable* APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava:***reliable*** APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava:___reliable___ APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava (platform)*reliable* APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava [platform]*reliable* APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava)*reliable* APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds APIs*reliable*.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds APIs**reliable**.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <https://example.com>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <mailto:ava@example.com>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. &lt;https://example.com&gt;')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <ava@example.com>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. &lt;ava@example.com&gt;')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <ftp://example.com>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n\n    audit')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs.\n\taudit')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary\u2028Product Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary\u2029Product Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary\u0085Product Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary\r\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional Summary\rProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleHasReservedTransportMetadataPrefix('Ava builds reliable APIs.\u2028Operation ID: audit-001')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Professional\u200b Summary\nProduct Engineer at Atlas builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. Operation\u200b ID: audit-001')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <operationId>audit</operationId>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. &lt;operationId&gt;audit&lt;/operationId&gt;')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <!-- audit -->')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <!DOCTYPE html>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <![CDATA[audit]]>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. <?xml version="1.0"?>')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. &lt;!-- audit --&gt;')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. {"enabled":true}')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. {audit: "pass"}')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. Note: this version improves clarity.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. “Note: this version improves clarity.”')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Hinweis: Diese Fassung verbessert die Klarheit.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('注: この版は明確さを改善します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('ملاحظة: هذه النسخة أوضح.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('नोट: यह संस्करण स्पष्ट है।')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Sure, Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Here you go: Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('I revised the summary: Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Here is the revised summary: Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('“Here is the revised summary: Ava builds reliable APIs.”')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Here is your polished summary: Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Below is the revised summary: Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. (Note: rewritten for clarity).')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('[Explanation: polished wording] Ava builds reliable APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs. — Note: rewritten for clarity.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs; Here is the revised summary: rewritten for clarity.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Hier ist die überarbeitete Zusammenfassung: Ava entwickelt zuverlässige APIs.')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('以下は更新された要約です: アトラスのエンジニアがAPIを構築します。')).toBe(true);
    expect(summaryV3StyleIsMarkdownOrList('Ava noted reliable API risks and builds reliable APIs.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava compares A < B while building reliable APIs.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava compares (a * b) while building reliable APIs.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava records service_api as an ordinary identifier.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava records service_api_version as an ordinary identifier.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava records a\tseparate detail in ordinary prose.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava calculates 3*5 reliably.')).toBe(false);
    expect(summaryV3StyleIsMarkdownOrList('Ava builds reliable APIs {without a metadata label}.')).toBe(false);
  });

  it('uses a meaningful script ratio and rejects a clear foreign-Latin source signal for same-label ownership input', () => {
    expect(summaryV3StyleLocaleSurfaceMatches('أعدت المختصة ملخصا مهنيا واضحا.', 'ar')).toBe(true);
    expect(summaryV3StyleLocaleSurfaceMatches('أ Product Engineer', 'ar')).toBe(false);
    expect(summaryV3StyleLocaleContentMatches('Ava Patel is an Engineer at Atlas and mentors peers.', 'de')).toBe(false);
  });

  it('extracts one maximal Japanese full calendar-date surface next to ordinary Japanese prose', () => {
    const source = '森はアトラスのエンジニアとして2020年5月1日にAPIを構築しました。';
    expect(summaryV3StyleCalendarDateRanges(source).map(([start, end]) => source.slice(start, end))).toEqual(['2020年5月1日']);
    const dayFirst = 'Produktentwicklerin bei Atlas arbeitet seit 01.05.2020 an zuverlässigen APIs.';
    expect(summaryV3StyleCalendarDateRanges(dayFirst).map(([start, end]) => dayFirst.slice(start, end))).toEqual(['01.05.2020']);
  });

  it.each(localeEmploymentFixtures)('keeps current/prior identity, grammatical role form, and structured duration for %s', (fixture) => {
    const snapshot = createSummaryV3StyleOperationSnapshot({
      ...requestFor('professional'),
      requestedLocale: fixture.locale,
      sourceLocale: fixture.locale,
      visibleSummary: fixture.source,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: `locale-${fixture.locale}-manifest`,
        contextId: `locale-${fixture.locale}-context`,
        sourceLocale: fixture.locale,
        currentRoleEntryId: 'current',
        entries: [
          { stableId: 'current', role: fixture.role, employer: fixture.employer, employmentState: 'present', durationMonths: 24, facts: [{ id: 'current-fact', text: fixture.fact }] },
          { stableId: 'prior', role: fixture.priorRole, employer: fixture.priorEmployer, employmentState: 'completed', durationMonths: 12, facts: [{ id: 'prior-fact', text: fixture.priorFact }] },
        ],
      },
    });
    expect(snapshot.currentRoleEntryId).toBe('current');
    expect(snapshot.structuredDurationMonths).toBe(36);
    expect(snapshot.selectedEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ stableId: 'current', employmentState: 'present', durationMonths: 24, roleHash: hashSummaryV3StyleValue(fixture.role) }),
      expect.objectContaining({ stableId: 'prior', employmentState: 'completed', durationMonths: 12, roleHash: hashSummaryV3StyleValue(fixture.priorRole) }),
    ]));
    expect(snapshot.snapshotHash).toMatch(/^m5_[0-9a-f]{8}$/u);
  });

  it.each([
    ['en', 'Mila Novak is an Analyst at Nova. She improves reports over 12 months.'],
    ['de', 'Mila Novak ist Analystin bei Nova. Sie verbessert Berichte seit 12 Monaten.'],
    ['sr', 'Mila Novak je analitičarka u Nova. Unapređuje izveštaje već 12 meseci.'],
    ['hi', 'मीरा नोवा में विश्लेषक हैं। उन्होंने 12 महीनों में रिपोर्ट बेहतर की।'],
    ['ar', 'ميرا محللة في نوفا. حسنت التقارير خلال 12 شهرا.'],
    ['ja', 'ミラはノヴァのアナリストです。12か月間でレポートを改善しました。'],
  ])('keeps compact representative %s script facts hashable and structured', (locale, text) => {
    expect(normalizedSummaryV3StyleLength(text)).toBeGreaterThan(0);
    expect(countSummaryV3StyleUnits(text)).toBeGreaterThan(0);
    expect(countSummaryV3StyleClauses(text)).toBeGreaterThan(0);
    expect(canonicalSummaryV3StyleLocale(locale)).toBe(locale);
  });
});
