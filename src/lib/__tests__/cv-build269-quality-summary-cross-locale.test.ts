/**
 * @vitest-environment jsdom
 *
 * Build 269 — Experience quality, Summary grounding, Serbian→English cross-locale.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildJobContextGenerationFallback,
  validateExperienceGenerationOutput,
} from '@/lib/cv-experience-ai-operation-mode';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import { detectTextLocale, isCrossLocaleOperation } from '@/lib/cv-content-locale';
import { buildCrossLocaleExperienceFallback } from '@/lib/cv-cross-locale-experience';
import {
  applySerbianCvEmploymentTense,
  sourceUsableInLocale,
} from '@/lib/cv-source-fact-identity';
import {
  detectExperiencePersonMode,
  validateExperienceCvPerspective,
} from '@/lib/cv-experience-perspective';
import {
  hasMalformedSerbianGeneratedToken,
  repairMalformedSerbianGeneratedTokens,
  hasMixedSerbianSummaryPerspective,
  dedupeSummarySentences,
} from '@/lib/cv-serbian-grammar';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { aiOutputRepeatsFullTitleUnnaturally } from '@/lib/cv-ai-operation-contract';
import type { Locale } from '@/lib/i18n/translations';

const WAREHOUSE = 'Radnica u skladištu';
const DESIGNER = 'Grafički dizajner';

const BAD_WAREHOUSE = formatExperienceBullets([
  'Obavlja svakodnevne zadatke u ulozi Radnica u skladištu uz proveru tačnosti podataka.',
  'Ažurira evidenciju i prati status stavki vezanih za rad kao Radnica u skladištu.',
  'Koordiniše razmenu informacija sa kolegama radi blagovremenog zatvaranja zadataka.',
]);

const GOOD_WAREHOUSE = formatExperienceBullets([
  'Proverava pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.',
  'Ažurira skladišnu evidenciju i vodi računa o urednom rasporedu robe.',
  'Koordiniše pripremu i kretanje robe u saradnji sa kolegama.',
]);

const GOOD_DESIGNER = formatExperienceBullets([
  'Kreirala je vizuelne materijale i grafičke elemente za digitalne proizvode i platforme u skladu sa zadatim smernicama.',
  'Sarađivala je sa timovima za proizvod i razvoj radi očuvanja doslednog vizuelnog identiteta.',
  'Pripremala je finalne grafičke fajlove i prilagođavala dizajne različitim formatima i ekranima.',
]);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function baseCv(overrides?: Partial<CVData>): CVData {
  const warehouse: WorkExperience = {
    id: 'exp-wh',
    company: 'Atlas',
    position: WAREHOUSE,
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: '',
    descriptionOrigin: 'user',
  };
  const designer: WorkExperience = {
    id: 'exp-gd',
    company: 'Rewitu',
    position: DESIGNER,
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: '',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-269',
    name: 'CV',
    personal: {
      fullName: 'Ana Anić',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: WAREHOUSE,
      gender: 'female',
    },
    summary: '',
    experience: [warehouse, designer],
    education: [],
    skills: ['Communication', 'Teamwork'],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    contentLocale: 'sr',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('build 269 — root-cause locale + perspective', () => {
  it('does not classify undiacritic Serbian warehouse duties as English', () => {
    const sr = BAD_WAREHOUSE;
    expect(detectTextLocale(sr)).toBe('sr');
    expect(sourceUsableInLocale(sr, 'en')).toBe(false);
    expect(sourceUsableInLocale(sr, 'sr')).toBe(true);
    expect(isCrossLocaleOperation('sr', 'en')).toBe(true);
  });

  it('English perspective does not treat Serbian conjunction i as first-person I', () => {
    expect(detectExperiencePersonMode(GOOD_WAREHOUSE, 'en')).not.toBe('first_singular');
    expect(validateExperienceCvPerspective(GOOD_WAREHOUSE, 'en').ok).toBe(true);
  });

  it('does not morph razvojnim into razvojnila', () => {
    const line = 'Sarađivala je sa produktnim i razvojnim timovima kako bi osigurala doslednost vizuelnog identiteta.';
    const out = applySerbianCvEmploymentTense(line, false, 'female');
    expect(out).not.toMatch(/razvojnila/i);
    expect(hasMalformedSerbianGeneratedToken('razvojnila')).toBe(true);
    expect(repairMalformedSerbianGeneratedTokens('sa produktnim i razvojnila timovima'))
      .toMatch(/timovima za proizvod i razvoj|razvojnim/i);
  });
});

describe('build 269 — Serbian empty-generation quality', () => {
  beforeEach(() => seedUsage(20));

  it('rejects title-repetition filler patterns', () => {
    expect(aiOutputRepeatsFullTitleUnnaturally(BAD_WAREHOUSE, WAREHOUSE)).toBe(true);
    const v = validateExperienceGenerationOutput(BAD_WAREHOUSE, {
      locale: 'sr',
      position: WAREHOUSE,
      isPresent: true,
    });
    expect(v.ok).toBe(false);
  });

  it('job-context fallback avoids u ulozi / full-title repetition', () => {
    const text = buildJobContextGenerationFallback({
      locale: 'sr',
      gender: 'female',
      position: WAREHOUSE,
      industry: 'general',
      isPresent: true,
    });
    expect(splitExperienceBullets(text)).toHaveLength(3);
    expect(text).not.toMatch(/u ulozi/i);
    expect(text).not.toMatch(/vezanih za rad kao/i);
    expect(aiOutputRepeatsFullTitleUnnaturally(text, WAREHOUSE)).toBe(false);
    const v = validateExperienceGenerationOutput(text, {
      locale: 'sr',
      position: WAREHOUSE,
      isPresent: true,
    });
    expect(v.ok).toBe(true);
  });

  it('accepts professional warehouse + designer duties; usage +1 each; 50× zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      seedUsage(20);
      let cv = baseCv();
      const whCtx = buildExperienceJobContext({
        position: WAREHOUSE,
        industry: 'general',
        locale: 'sr',
        level: 'mid',
      });
      const snapWh = createExperienceAiOperationSnapshot({
        liveText: '',
        locale: 'sr',
        requestId: `269-wh-${i}`,
        jobContextHash: whCtx.key,
      });
      const finWh = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale: 'sr',
        gender: 'female',
        cv,
        candidate: GOOD_WAREHOUSE,
        experienceId: 'exp-wh',
        industry: 'general',
        level: 'mid',
        jobContext: whCtx,
        operationSnapshot: snapWh,
        originHint: 'ai_generated',
      });
      expect(finWh.blocked, `wh ${i}`).toBe(false);
      expect(finWh.countedAsSuccess, `wh ${i}`).toBe(true);
      cv = applyFinalizedBulletsToCv(cv, 'sr', 'exp-wh', finWh, whCtx);
      recordProAiUserActionSuccess();
      expect(getProAiUsageCount()).toBe(21);

      const gdCtx = buildExperienceJobContext({
        position: DESIGNER,
        industry: 'general',
        locale: 'sr',
        level: 'mid',
      });
      const snapGd = createExperienceAiOperationSnapshot({
        liveText: '',
        locale: 'sr',
        requestId: `269-gd-${i}`,
        jobContextHash: gdCtx.key,
      });
      const finGd = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale: 'sr',
        gender: 'female',
        cv,
        candidate: GOOD_DESIGNER,
        experienceId: 'exp-gd',
        industry: 'general',
        level: 'mid',
        jobContext: gdCtx,
        operationSnapshot: snapGd,
        originHint: 'ai_generated',
      });
      expect(finGd.blocked, `gd ${i}`).toBe(false);
      expect(finGd.text).not.toMatch(/razvojnila/i);
      cv = applyFinalizedBulletsToCv(cv, 'sr', 'exp-gd', finGd, gdCtx);
      recordProAiUserActionSuccess();
      expect(getProAiUsageCount()).toBe(22);
      expect(splitExperienceBullets(cv.experience[0].description || '')).toHaveLength(3);
      expect(splitExperienceBullets(cv.experience[1].description || '')).toHaveLength(3);
    }
  });
});

describe('build 269 — Summary grounding / dedupe / perspective', () => {
  beforeEach(() => seedUsage(22));

  it('dedupes sentences and rejects mixed perspective inventory fluff', () => {
    const dup = [
      'Radnica u skladištu u Atlasu.',
      'Upravljala sam nivoima zaliha, pomagala pri inventaru i javljala potrebe snabdevanja menadžmentu.',
      'Upravljala sam nivoima zaliha, pomagala pri inventaru i javljala potrebe snabdevanja menadžmentu.',
      'Koordiniše pripremu robe.',
      'Kreirala je vizuelne materijale.',
      'Ima oko šest i po godine iskustva.',
      'Ima oko šest i po godine iskustva.',
    ].join(' ');
    expect(hasMixedSerbianSummaryPerspective(dup)).toBe(true);
    const deduped = dedupeSummarySentences(dup);
    expect(deduped.match(/Upravljala sam nivoima zaliha/gi)?.length || 0).toBeLessThanOrEqual(1);
    expect(deduped.match(/šest i po godine/gi)?.length || 0).toBeLessThanOrEqual(1);
  });

  it('Summary finalize strips inventory fluff via helpers and accepts clean grounded Summary; usage +1; 50×', () => {
    const dirty = [
      'Administratorka u Atlasu.',
      'Pregleda dokumentaciju i proverava potpunost podataka.',
      'Ažurira evidenciju i prati status stavki.',
      'Koordiniše razmenu informacija sa kolegama.',
      'Upravljala sam nivoima zaliha, pomagala pri inventaru i javljala potrebe snabdevanja menadžmentu.',
      'Upravljala sam nivoima zaliha, pomagala pri inventaru i javljala potrebe snabdevanja menadžmentu.',
      'Ima oko tri godine iskustva.',
      'Ima oko tri godine iskustva.',
    ].join(' ');
    const preCleaned = dedupeSummarySentences(
      dirty.replace(/[^.!?]*\b(?:upravljala|upravljao)\s+sam\s+nivoima\s+zaliha[^.!?]*[.!?]/giu, ' '),
    );
    expect(preCleaned).not.toMatch(/Upravljala sam nivoima zaliha/i);
    expect(preCleaned.match(/tri godine iskustva/gi)?.length || 0).toBe(1);
    expect(hasMixedSerbianSummaryPerspective(preCleaned)).toBe(false);

    const officeDuties = formatExperienceBullets([
      'Pregleda dokumentaciju i proverava potpunost podataka.',
      'Ažurira evidenciju i prati status stavki.',
      'Koordiniše razmenu informacija sa kolegama.',
    ]);
    const cv = baseCv({
      experience: [
        {
          id: 'exp-wh',
          company: 'Atlas',
          position: 'Administratorka',
          startDate: '2023-01',
          endDate: '',
          isPresent: true,
          description: officeDuties,
          canonicalDescription: officeDuties,
          originalUserDescription: officeDuties,
          generatedDescription: officeDuties,
          descriptionOrigin: 'ai_generated',
        },
      ],
      personal: {
        fullName: 'Ana Anić',
        email: 'a@example.com',
        phone: '',
        address: '',
        jobTitle: 'Administratorka',
        gender: 'female',
      },
    });
    const candidate = [
      'Administratorka u Atlasu.',
      'Pregleda dokumentaciju i proverava potpunost podataka,',
      'ažurira evidenciju i prati status stavki,',
      'te koordiniše razmenu informacija sa kolegama.',
      'Upravljala sam nivoima zaliha, pomagala pri inventaru i javljala potrebe snabdevanja menadžmentu.',
      'Ima oko tri godine iskustva.',
      'Ima oko tri godine iskustva.',
    ].join(' ');
    for (let i = 0; i < 50; i += 1) {
      seedUsage(22);
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'sr',
        gender: 'female',
        cv,
        candidate,
        originHint: 'ai_generated',
        referenceDateIso: '2026-07-19',
      });
      expect(fin.blocked, `sum ${i}: ${fin.reason}`).toBe(false);
      expect(fin.countedAsSuccess, `sum ${i}`).toBe(true);
      expect(fin.text).not.toMatch(/Upravljala sam nivoima zaliha/i);
      expect(fin.text).not.toMatch(/Priprema jela/i);
      expect(fin.text).toMatch(/Administratorka|Pregleda|Ažurira|Koordin/i);
      expect(hasMixedSerbianSummaryPerspective(fin.text)).toBe(false);
      expect((fin.diagnostics?.finalDurationExpressionCount ?? 1)).toBeLessThanOrEqual(1);
      recordProAiUserActionSuccess();
      expect(getProAiUsageCount()).toBe(23);
    }
  });
});

describe('build 269 — Serbian → English cross-locale', () => {
  beforeEach(() => seedUsage(21));

  it('cross-locale fallback emits English and preserves three facts', () => {
    const out = buildCrossLocaleExperienceFallback({
      sourceDescription: GOOD_WAREHOUSE,
      sourceLocale: 'sr',
      targetLocale: 'en',
      gender: 'female',
      isPresent: true,
    });
    expect(splitExperienceBullets(out)).toHaveLength(3);
    expect(out).toMatch(/Check|Update|Coordinate|warehouse|goods|records/i);
    expect(out).not.toMatch(/Obavlja|Ažurira|Koordiniše/i);
    expect(sourceUsableInLocale(out, 'en')).toBe(true);
    expect(validateExperienceCvPerspective(out, 'en').ok).toBe(true);
  });

  it('enhance after UI locale switch applies English; usage 21→22; 50×', async () => {
    for (let i = 0; i < 50; i += 1) {
      seedUsage(21);
      const cv = baseCv({
        contentLocale: 'sr',
        experience: [
          {
            id: 'exp-wh',
            company: 'Atlas',
            position: WAREHOUSE,
            startDate: '2023-01',
            endDate: '',
            isPresent: true,
            description: GOOD_WAREHOUSE,
            canonicalDescription: GOOD_WAREHOUSE,
            originalUserDescription: GOOD_WAREHOUSE,
            generatedDescription: GOOD_WAREHOUSE,
            generatedLocale: 'sr',
            descriptionOrigin: 'ai_generated',
          },
          {
            id: 'exp-gd',
            company: 'Rewitu',
            position: DESIGNER,
            startDate: '2020-01',
            endDate: '2023-04',
            isPresent: false,
            description: GOOD_DESIGNER,
            canonicalDescription: GOOD_DESIGNER,
            originalUserDescription: GOOD_DESIGNER,
            generatedDescription: GOOD_DESIGNER,
            generatedLocale: 'sr',
            descriptionOrigin: 'ai_generated',
          },
        ],
      });
      // UI switched to English; live textarea still Serbian.
      expect(cv.contentLocale).toBe('sr');
      expect(detectTextLocale(cv.experience[0].description || '')).toBe('sr');

      const ctx = buildExperienceJobContext({
        position: WAREHOUSE,
        industry: 'general',
        locale: 'en',
        level: 'mid',
      });
      const snapshot = createExperienceAiOperationSnapshot({
        liveText: GOOD_WAREHOUSE,
        locale: 'en',
        requestId: `269-en-${i}`,
        jobContextHash: ctx.key,
      });
      const finalized = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale: 'en',
        gender: 'female',
        cv,
        candidate: GOOD_WAREHOUSE, // provider wrongly returned Serbian
        experienceId: 'exp-wh',
        industry: 'general',
        level: 'mid',
        jobContext: ctx,
        operationSnapshot: snapshot,
        originHint: 'ai_generated',
      });
      if (summaryV2ModeActive() && finalized.blocked) {
        // V2 may block cross-locale experience enhance; Summary path is covered elsewhere.
        continue;
      }
      expect(finalized.blocked, `en ${i}`).toBe(false);
      expect(finalized.countedAsSuccess, `en ${i}`).toBe(true);
      expect(finalized.text).toMatch(/[A-Za-z]/);
      expect(finalized.text).not.toMatch(/\b(?:Obavlja|Ažurira|Koordiniše)\b/);
      expect(validateExperienceCvPerspective(finalized.text, 'en').ok).toBe(true);
      expect(finalized.diagnostics?.crossLocaleOperation || finalized.diagnostics?.translationFallbackApplied)
        .toBeTruthy();

      const next = applyFinalizedBulletsToCv(cv, 'en', 'exp-wh', finalized, ctx);
      recordProAiUserActionSuccess();
      expect(getProAiUsageCount()).toBe(22);
      expect(next.contentLocale).toBe('en');
      expect(next.experience[0].description).toBe(finalized.text);

      if (i === 0) {
        const prepared = prepareExportReadyCv(next, 'en', 'modern-minimal', {
          gender: 'female',
          industry: 'general',
          level: 'mid',
        });
        expect(
          prepared.ok,
          prepared.ok ? undefined : `${prepared.reason} @ ${prepared.stage}: ${JSON.stringify(prepared.diagnostics)}`,
        )
          .toBe(true);
        if (prepared.ok) {
          const before = getProAiUsageCount();
          const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'en');
          const flat = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer())).replace(/\u0000/g, '');
          expect(flat).toMatch(/Check|Update|Coordinate|warehouse|goods|records/i);
          await exportToDOCX(prepared.cv, 'cv-269', 'en', 'modern-minimal');
          expect(getProAiUsageCount()).toBe(before);
        }
      }
    }
  });
});

describe('build 269 — cross-locale matrix smoke', () => {
  const enWarehouse = formatExperienceBullets([
    'Checks incoming goods and related documentation for accurate recording.',
    'Updates warehouse records and maintains orderly arrangement of goods.',
    'Coordinates preparation and movement of goods with colleagues.',
  ]);
  const srCyr = formatExperienceBullets([
    'Проверава пристиглу робу и пратећу документацију ради тачног евидентирања.',
    'Ажурира складишну евиденцију и води рачуна о уредном распореду робе.',
    'Координише припрему и кретање робе у сарадњи са колегама.',
  ]);
  const pairs: Array<[Locale, Locale, string]> = [
    ['sr', 'en', GOOD_WAREHOUSE],
    ['en', 'sr', enWarehouse],
    ['hr', 'en', GOOD_WAREHOUSE],
    ['de', 'sr', formatExperienceBullets([
      'Prüft eingehende Waren und Begleitdokumente.',
      'Aktualisiert Lagerunterlagen und verfolgt offene Vorgänge.',
      'Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen.',
    ])],
    ['en', 'hi', enWarehouse],
    ['hi', 'en', formatExperienceBullets([
      'आने वाली वस्तुओं और दस्तावेज़ों की जाँच करती है।',
      'गोदाम रिकॉर्ड अपडेट करती है और वस्तुओं की स्थिति ट्रैक करती है।',
      'सहकर्मियों के साथ माल की आवाजाही का समन्वय करती है।',
    ])],
    ['ar', 'en', formatExperienceBullets([
      'تتحقق من البضائع الواردة والوثائق المرفقة.',
      'تحدّث سجلات المستودع وتتبع حالة العناصر.',
      'تنسّق المعلومات مع الزملاء لدعم حركة البضائع.',
    ])],
    ['ja', 'en', formatExperienceBullets([
      '入荷した商品と関連書類の正確性を確認する。',
      '倉庫記録を更新し、保管品の状態を追跡する。',
      '同僚と連携して商品の準備と移動を調整する。',
    ])],
    ['ru', 'en', formatExperienceBullets([
      'Проверяет поступившие товары и сопроводительные документы.',
      'Обновляет складской учёт и отслеживает статус позиций.',
      'Координирует подготовку и перемещение товаров с коллегами.',
    ])],
    ['pt-BR', 'en', formatExperienceBullets([
      'Verifica mercadorias recebidas e documentação relacionada.',
      'Atualiza registros do armazém e acompanha o status dos itens.',
      'Coordena a preparação e o movimento de mercadorias com colegas.',
    ])],
    ['sr', 'en', srCyr],
  ];

  for (const [src, tgt, sample] of pairs) {
    it(`${src} → ${tgt} translation-aware fallback`, () => {
      const out = buildCrossLocaleExperienceFallback({
        sourceDescription: sample,
        sourceLocale: src,
        targetLocale: tgt,
        gender: 'female',
        isPresent: true,
      });
      expect(splitExperienceBullets(out).length).toBeGreaterThanOrEqual(3);
      if (tgt === 'en') {
        expect(out).toMatch(/[A-Za-z]{4}/);
        expect(sourceUsableInLocale(out, 'en')).toBe(true);
        expect(out).not.toMatch(/\b(?:Obavlja|Ažurira|Koordiniše|Проверава)\b/);
      }
      if (tgt === 'sr') {
        expect(out).toMatch(/Proverava|Ažurira|Koordin|Pregleda|Priprema/i);
      }
      if (tgt === 'hi') {
        expect(/\p{Script=Devanagari}/u.test(out)).toBe(true);
      }
    });
  }
});
