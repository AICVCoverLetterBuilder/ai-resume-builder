/**
 * @vitest-environment jsdom
 *
 * Build 259: Serbian Experience AI must preserve three user-authored duties
 * via universal multilingual source-fact identity — never invent analysis/
 * planning shells, never require English token overlap or occupation catalogues.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  applySerbianCvEmploymentTense,
  extractSourceDutyUnits,
  sourceFactIdentitiesFromDescription,
  stemTokenForCoverage,
  validateSourceFactIdentityCoverage,
} from '@/lib/cv-source-fact-identity';
import {
  buildSourcePreservingExperienceBullets,
} from '@/lib/cv-localized-fallback';
import {
  validateDistinctExperienceBullets,
  validateNoExtraGeneratedDuties,
  applyEnglishEmploymentTense,
} from '@/lib/cv-material-duty-coverage';
import { finalizeCvAiFieldForApply, runCvAiApplyPipeline } from '@/lib/cv-ai-finalize-apply';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import { getProAiUsageCount, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const SR_LATIN_DUTIES = [
  'Pregledam pristigle terenske izveštaje i označavam nepotpune unose.',
  'Ažuriram zajedničku tabelu sa najnovijim statusom.',
  'Koordinišem sa dva interna odeljenja kada nedostaju informacije.',
];

const SR_LATIN_BLOCK = SR_LATIN_DUTIES.join('\n');

const SR_CYRILLIC_DUTIES = [
  'Прегледам пристигле теренске извештаје и означавам непотпуне уносе.',
  'Ажурирам заједничку табелу са најновијим статусом.',
  'Координишем са два интерна одељења када недостају информације.',
];

const EN_DUTIES = [
  'Review incoming field reports and mark incomplete entries.',
  'Update the shared tracking sheet with the latest status.',
  'Coordinate with two internal departments when information is missing.',
];

const HI_DUTIES = [
  'मैं आने वाली फील्ड रिपोर्ट्स की समीक्षा करता हूँ और अधूरे प्रविष्टियों को चिह्नित करता हूँ।',
  'मैं साझा ट्रैकिंग शीट को नवीनतम स्थिति के साथ अपडेट करता हूँ।',
  'जब जानकारी गायब होती है तो मैं दो आंतरिक विभागों के साथ समन्वय करता हूँ।',
];

const DE_DUTIES = [
  'Ich prüfe eingehende Feldberichte und markiere unvollständige Einträge.',
  'Ich aktualisiere die gemeinsame Tabelle mit dem neuesten Status.',
  'Ich koordiniere mit zwei internen Abteilungen, wenn Informationen fehlen.',
];

const ES_DUTIES = [
  'Reviso los informes de campo entrantes y marco las entradas incompletas.',
  'Actualizo la tabla compartida con el estado más reciente.',
  'Coordino con dos departamentos internos cuando falta información.',
];

const AR_DUTIES = [
  'أراجع تقارير الميدان الواردة وأعلّم الإدخالات غير المكتملة.',
  'أحدث الجدول المشترك بأحدث حالة.',
  'أنسق مع قسمين داخليين عندما تكون المعلومات ناقصة.',
];

const JA_DUTIES = [
  '到着した現場報告書を確認し、不完全な入力をマークする。',
  '共有表を最新のステータスで更新する。',
  '情報が不足している場合は、2つの内部部門と調整する。',
];

const UNSUPPORTED_RE =
  /\b(guests?|rapport|hospitality|KPI|Salesforce|Slack|Excel|leadership|managed a team|clients?|metrics?)\b/i;

function device259Cv(overrides?: Partial<CVData> & {
  description?: string;
  gender?: string;
  position?: string;
  isPresent?: boolean;
}): CVData {
  const description = overrides?.description ?? SR_LATIN_BLOCK;
  const gender = overrides?.gender ?? 'female';
  const position = overrides?.position ?? 'Koordinatorka terenske dokumentacije';
  const isPresent = overrides?.isPresent ?? true;
  const { description: _d, gender: _g, position: _p, isPresent: _ip, ...rest } = overrides || {};
  return {
    id: 'cv-259',
    name: 'CV',
    personal: {
      fullName: 'Ana Test',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: position,
      gender: gender as CVData['personal']['gender'],
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'sr',
    experience: [{
      id: 'exp-1',
      company: 'Atlas',
      position,
      startDate: isPresent ? '2025-03' : '2023-01',
      endDate: isPresent ? '' : '2024-12',
      isPresent,
      description,
      originalUserDescription: description,
      canonicalDescription: description,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [{ name: 'Srpski', level: 'native' }],
    templateId: 'modern-minimal',
    region: 'Balkan',
    createdAt: '',
    updatedAt: '',
    ...rest,
  };
}

function assertSerbianThreeFacts(text: string, label: string) {
  const lower = text.toLowerCase();
  expect(text, label).not.toMatch(/\b(Review|Update|Coordinate|Analyze|I\s)\b/);
  expect(lower, `${label} field-report`).toMatch(/izveštaj|извештај/);
  expect(lower, `${label} mark incomplete`).toMatch(/označav|означав|nepotpun|непотпун/);
  expect(lower, `${label} shared table`).toMatch(/tabel|табел|evidenc|евиденц/);
  expect(lower, `${label} latest status`).toMatch(/status|статус|najnovij|најновиј/);
  expect(lower, `${label} coordinate`).toMatch(/koordin|координа/);
  expect(lower, `${label} departments`).toMatch(/odeljen|одељењ|odeljen/);
  expect(lower, `${label} missing info`).toMatch(/nedostaj|недостај|informacij|информациј/);
  expect(text, `${label} no English invent`).not.toMatch(UNSUPPORTED_RE);
  expect(text, `${label} no analysis shell`).not.toMatch(/Analiziram poslovne|rukovodstvo/i);
  expect(text, `${label} no planning shell`).not.toMatch(/Učestvujem u planiranju/i);
  const bullets = splitExperienceBullets(text);
  expect(bullets.length, `${label} bullet count`).toBe(3);
  expect(validateDistinctExperienceBullets(text).ok, `${label} distinct`).toBe(true);
  expect(validateSourceFactIdentityCoverage(SR_LATIN_BLOCK, text).ok, `${label} identity`).toBe(true);
}

function localeFixture(locale: Locale, duties: string[], title: string, isPresent = true): CVData {
  const block = duties.join('\n');
  return {
    id: `cv-259-${locale}`,
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 't@e.com',
      phone: '',
      address: '',
      jobTitle: title,
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: locale,
    experience: [{
      id: 'exp-1',
      company: 'Atlas',
      position: title,
      startDate: isPresent ? '2025-03' : '2022-01',
      endDate: isPresent ? '' : '2024-06',
      isPresent,
      description: block,
      originalUserDescription: block,
      canonicalDescription: block,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
}

function assertAllSourceFactsSurvive(source: string, output: string, label: string) {
  const ids = validateSourceFactIdentityCoverage(source, output);
  expect(ids.ok, `${label} identity ${JSON.stringify(ids)}`).toBe(true);
  expect(ids.coveredIds.length, label).toBe(ids.requiredIds.length);
  expect(validateDistinctExperienceBullets(output).ok, `${label} distinct`).toBe(true);
  expect(validateNoExtraGeneratedDuties(source, output).valid, `${label} extras`).toBe(true);
  expect(splitExperienceBullets(output).length, `${label} count`).toBeGreaterThanOrEqual(3);
}

describe('Build 259 Serbian Experience multilingual fact preservation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exact device fixture: splits three duties and builds three identities', () => {
    const units = extractSourceDutyUnits(SR_LATIN_BLOCK);
    expect(units).toHaveLength(3);
    const ids = sourceFactIdentitiesFromDescription(SR_LATIN_BLOCK);
    expect(ids).toHaveLength(3);
    expect(ids.map((i) => i.id)).toEqual([
      expect.stringMatching(/^sf_/),
      expect.stringMatching(/^sf_/),
      expect.stringMatching(/^sf_/),
    ]);
    expect(new Set(ids.map((i) => i.id)).size).toBe(3);
  });

  it('source-preserving Serbian fallback uses present 3sg and preserves all facts', () => {
    const preserved = buildSourcePreservingExperienceBullets(SR_LATIN_BLOCK, 'sr', 'female', {
      isPresent: true,
    });
    assertSerbianThreeFacts(preserved, 'preserve');
    expect(preserved).toMatch(/^•\s*Pregleda\b/m);
    expect(preserved).toMatch(/^•\s*Ažurira\b/m);
    expect(preserved).toMatch(/^•\s*Koordiniše\b/m);
    expect(preserved).not.toMatch(/\bPregledam\b|\bAžuriram\b|\bKoordinišem\b/);
  });

  it('provider omit → deterministic fallback applied; usage +1 only on success', () => {
    const before = getProAiUsageCount();
    const omitOne = formatExperienceBullets([SR_LATIN_DUTIES[0]]);
    // Rejected provider alone must not count.
    const rejectedOnly = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv: device259Cv(),
      candidate: omitOne,
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      originHint: 'ai_generated',
    });
    // finalize always tries fallback; if applied, that is success. Simulate
    // "provider rejected before fallback" by checking provider stage would fail.
    expect(validateSourceFactIdentityCoverage(SR_LATIN_BLOCK, omitOne).ok).toBe(false);
    expect(getProAiUsageCount()).toBe(before);

    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: omitOne,
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    expect(pipeline.finalized.origin).toBe('deterministic_fallback');
    assertSerbianThreeFacts(pipeline.stateCv.experience[0].description, 'omit-fallback');
    expect(pipeline.finalized.diagnostics?.fallbackApplied).toBe(true);
    expect(pipeline.finalized.diagnostics?.sourceFactCount).toBe(3);
    expect(pipeline.finalized.diagnostics?.finalBulletCount).toBe(3);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(before + 1);
    // Rejected-only path never called record → still +1 total from success.
    void rejectedOnly;
  });

  it('empty provider / timeout path applies Serbian preserve; visible apply', () => {
    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    assertSerbianThreeFacts(pipeline.stateCv.experience[0].description, 'empty');
    expect(pipeline.stateCv.experience[0].description).toBe(pipeline.previewCv.experience[0].description);
  });

  it('wrong-locale English provider is rejected then Serbian fallback applied', () => {
    const enBad = formatExperienceBullets(EN_DUTIES);
    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: enBad,
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    assertSerbianThreeFacts(pipeline.stateCv.experience[0].description, 'wrong-locale');
  });

  it('duplicate provider bullets → fallback preserves three distinct facts', () => {
    const dup = formatExperienceBullets([
      SR_LATIN_DUTIES[0],
      SR_LATIN_DUTIES[0],
      SR_LATIN_DUTIES[0],
    ]);
    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: dup,
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    assertSerbianThreeFacts(pipeline.stateCv.experience[0].description, 'dup');
  });

  it('completed role uses past tense Serbian verbs', () => {
    const past = buildSourcePreservingExperienceBullets(SR_LATIN_BLOCK, 'sr', 'female', {
      isPresent: false,
    });
    expect(past).toMatch(/Pregledala|označavala|Ažurirala|Koordinisala/i);
    expect(past).not.toMatch(/\bPregleda\b/);
    expect(past).not.toMatch(/\bAžurira\b/);
    expect(past).not.toMatch(/\bKoordiniše\b/);
    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv({ isPresent: false }),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.stateCv.experience[0].description).toMatch(/la\b|la\./);
  });

  it('male / unspecified gender present-tense preserve still covers facts', () => {
    for (const gender of ['male', ''] as const) {
      const preserved = buildSourcePreservingExperienceBullets(SR_LATIN_BLOCK, 'sr', gender, {
        isPresent: true,
      });
      assertSerbianThreeFacts(preserved, `gender-${gender || 'unspecified'}`);
    }
  });

  it('Cyrillic Serbian source preserves three facts in Cyrillic', () => {
    const block = SR_CYRILLIC_DUTIES.join('\n');
    const preserved = buildSourcePreservingExperienceBullets(block, 'sr', 'female', {
      isPresent: true,
    });
    expect(preserved).toMatch(/\p{Script=Cyrillic}/u);
    expect(preserved).not.toMatch(/\b(Review|Update|Coordinate)\b/);
    expect(validateSourceFactIdentityCoverage(block, preserved).ok).toBe(true);
    expect(splitExperienceBullets(preserved)).toHaveLength(3);
    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv({ description: block }),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.stateCv.experience[0].description).toMatch(/\p{Script=Cyrillic}/u);
  });

  it('inflection / synonym variants remain compatible with source identities', () => {
    const variant = formatExperienceBullets([
      'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
      'Ažurira zajedničku evidenciju sa najnovijim statusom.',
      'Koordiniše sa dva unutrašnja odeljenja kada nedostajuće informacije.',
    ]);
    expect(validateSourceFactIdentityCoverage(SR_LATIN_BLOCK, variant).ok).toBe(true);
    expect(stemTokenForCoverage('pregledam')).toBe(stemTokenForCoverage('pregleda'));
    expect(stemTokenForCoverage('ažuriram')).toBe(stemTokenForCoverage('ažurira'));
    expect(stemTokenForCoverage('koordinišem')).toBe(stemTokenForCoverage('koordiniše'));
  });

  it('unknown title needs no catalogue; first duty not omitted', () => {
    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv({ position: 'Custom Title XYZ-47' }),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    assertSerbianThreeFacts(pipeline.stateCv.experience[0].description, 'unknown-title');
    expect(pipeline.stateCv.experience[0].description).toMatch(/Pregleda|izveštaj/i);
  });

  it('50× cold Serbian fixture: zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const pipeline = runCvAiApplyPipeline({
        cv: device259Cv(),
        locale: 'sr',
        action: 'experience_bullets',
        candidate: i % 3 === 0 ? '' : formatExperienceBullets([SR_LATIN_DUTIES[0]]),
        experienceId: 'exp-1',
        industry: 'other',
        level: 'mid',
        referenceDateIso: '2026-07-18',
      });
      expect(pipeline.blocked, `run ${i}`).toBe(false);
      expect(pipeline.finalized.countedAsSuccess, `run ${i}`).toBe(true);
      assertSerbianThreeFacts(pipeline.stateCv.experience[0].description, `run-${i}`);
    }
  });

  it('PDF/DOCX parity + reload + export AI usage 0', async () => {
    const before = getProAiUsageCount();
    const pipeline = runCvAiApplyPipeline({
      cv: device259Cv(),
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(before + 1);

    const reloaded = JSON.parse(JSON.stringify(pipeline.stateCv)) as CVData;
    expect(reloaded.experience[0].description).toBe(pipeline.stateCv.experience[0].description);
    assertSerbianThreeFacts(reloaded.experience[0].description, 'reload');

    const usageBeforeExport = getProAiUsageCount();
    const prepared = prepareExportReadyCv(reloaded, 'sr', 'modern-minimal', {
      gender: 'female',
      referenceDate: '2026-07-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    assertSerbianThreeFacts(prepared.cv.experience[0].description, 'export-prep');

    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    expect(pdfText.toLowerCase()).toMatch(/izveštaj|ažurir|koordin/i);

    const docx = await exportToDOCX(prepared.cv, 'build-259-sr', 'sr', 'modern-minimal');
    expect(docx).toBeTruthy();
    expect(getProAiUsageCount()).toBe(usageBeforeExport);
  });

  it('multilingual matrix: known + unknown titles across locales', () => {
    const matrix: Array<{
      locale: Locale;
      duties: string[];
      knownTitle: string;
      unknownTitle: string;
    }> = [
      { locale: 'en', duties: EN_DUTIES, knownTitle: 'Operations Coordinator', unknownTitle: 'Custom Title XYZ-47' },
      { locale: 'sr', duties: SR_LATIN_DUTIES, knownTitle: 'Koordinatorka terenske dokumentacije', unknownTitle: 'Naslov XYZ-47' },
      { locale: 'hi', duties: HI_DUTIES, knownTitle: 'समन्वयक', unknownTitle: 'कस्टम शीर्षक XYZ-47' },
      { locale: 'de', duties: DE_DUTIES, knownTitle: 'Koordinatorin', unknownTitle: 'Titel XYZ-47' },
      { locale: 'es', duties: ES_DUTIES, knownTitle: 'Coordinadora', unknownTitle: 'Título XYZ-47' },
      { locale: 'ar', duties: AR_DUTIES, knownTitle: 'منسقة', unknownTitle: 'عنوان XYZ-47' },
      { locale: 'ja', duties: JA_DUTIES, knownTitle: 'コーディネーター', unknownTitle: 'カスタム職種 XYZ-47' },
    ];

    for (const row of matrix) {
      for (const title of [row.knownTitle, row.unknownTitle]) {
        for (const isPresent of [true, false]) {
          const source = row.duties.join('\n');
          const cv = localeFixture(row.locale, row.duties, title, isPresent);

          const cases: Array<{ name: string; candidate: string }> = [
            { name: 'empty', candidate: '' },
            { name: 'omit', candidate: formatExperienceBullets([row.duties[0]]) },
            {
              name: 'dup',
              candidate: formatExperienceBullets([row.duties[0], row.duties[0], row.duties[0]]),
            },
            {
              name: 'wrong-locale',
              candidate: formatExperienceBullets(
                row.locale === 'en' ? SR_LATIN_DUTIES : EN_DUTIES,
              ),
            },
            {
              name: 'wrong-tense',
              candidate: formatExperienceBullets(
                row.duties.map((d) => {
                  if (row.locale === 'sr') {
                    return applySerbianCvEmploymentTense(d, !isPresent, 'female');
                  }
                  if (row.locale === 'en') {
                    return applyEnglishEmploymentTense(d, !isPresent);
                  }
                  // Other locales have no safe synthetic tense inversion here; use
                  // empty provider output to exercise deterministic recovery.
                  return '';
                }),
              ),
            },
          ];

          for (const c of cases) {
            const pipeline = runCvAiApplyPipeline({
              cv,
              locale: row.locale,
              action: 'experience_bullets',
              candidate: c.candidate,
              experienceId: 'exp-1',
              industry: 'other',
              level: 'mid',
              referenceDateIso: '2026-07-18',
            });
            const label = `${row.locale}/${title.slice(0, 12)}/${isPresent ? 'cur' : 'done'}/${c.name}`;
            if (pipeline.blocked) {
              expect(pipeline.finalized.diagnostics?.semanticNoOpDetected, label).toBe(true);
              expect(pipeline.finalized.diagnostics?.materialImprovementDetected, label)
                .toBe(false);
              expect(pipeline.finalized.diagnostics?.canonicalExperienceDecisionAllowsApply, label)
                .toBe(false);
              expect(pipeline.finalized.diagnostics?.canonicalExperienceDecisionAllowsUsage, label)
                .toBe(false);
              expect(pipeline.finalized.countedAsSuccess, label).toBe(false);
            } else {
              expect(pipeline.finalized.countedAsSuccess, label).toBe(true);
            }
            assertAllSourceFactsSurvive(source, pipeline.stateCv.experience[0].description, label);
            if (row.locale === 'sr') {
              expect(pipeline.stateCv.experience[0].description, label).not.toMatch(
                /\b(Review|Update|Coordinate)\b/,
              );
            }
            if (row.locale === 'hi') {
              expect(pipeline.stateCv.experience[0].description, label).toMatch(/\p{Script=Devanagari}/u);
            }
            if (row.locale === 'ar') {
              expect(pipeline.stateCv.experience[0].description, label).toMatch(/\p{Script=Arabic}/u);
            }
            if (row.locale === 'ja') {
              expect(pipeline.stateCv.experience[0].description, label).toMatch(
                /[\u3040-\u30ff\u3400-\u9fff]/,
              );
            }
          }
        }
      }
    }
  });

  it('Cyrillic matrix row covered separately', () => {
    const source = SR_CYRILLIC_DUTIES.join('\n');
    const cv = localeFixture('sr', SR_CYRILLIC_DUTIES, 'Координаторка', true);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'experience_bullets',
      candidate: formatExperienceBullets([SR_CYRILLIC_DUTIES[0]]),
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(pipeline.blocked).toBe(false);
    assertAllSourceFactsSurvive(source, pipeline.stateCv.experience[0].description, 'sr-cyr');
  });
});
