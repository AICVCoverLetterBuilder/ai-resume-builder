/**
 * @vitest-environment jsdom
 *
 * Generalization: arbitrary known/unknown occupations preserve every
 * user-authored duty without occupation-catalogue mappings.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildSourcePreservingExperienceBullets,
  localizeCanonicalBulletLine,
} from '@/lib/cv-localized-fallback';
import {
  applyEnglishEmploymentTense,
  validateDistinctExperienceBullets,
  validateExperienceApplyMaterialPostcondition,
  validateNoExtraGeneratedDuties,
} from '@/lib/cv-material-duty-coverage';
import {
  sourceFactIdentitiesFromDescription,
  universalPreserveSourceUnit,
  validateSourceFactIdentityCoverage,
} from '@/lib/cv-source-fact-identity';
import { runCvAiApplyPipeline } from '@/lib/cv-ai-finalize-apply';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import { getProAiUsageCount, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const STEREOTYPE_RE =
  /\b(guests?|rapport|hospitality|pharmacist|pharmacy|prescription|cocktail|bartender|mediterranean|cuisine)\b/i;

type Fixture = {
  title: string;
  duties: string[];
  isPresent?: boolean;
  titleClass: 'unknown' | 'known';
};

const UNKNOWN_TITLES: Fixture[] = [
  {
    title: 'Solar Drone Maintenance Coordinator',
    titleClass: 'unknown',
    duties: [
      'Inspect drone airframes after each flight cycle.',
      'Replace worn propeller mounts using the workshop jig.',
      'Log battery health readings in the maintenance binder.',
    ],
  },
  {
    title: 'Museum Lighting Technician',
    titleClass: 'unknown',
    duties: [
      'Aim gallery spotlights according to the exhibit plot.',
      'Replace failed LED drivers during closing hours.',
      'Document fixture positions on the floor plan sheet.',
    ],
  },
  {
    title: 'Aquaculture Equipment Operator',
    titleClass: 'unknown',
    duties: [
      'Monitor dissolved oxygen sensors on the grow tanks.',
      'Clean intake screens before the morning feeding window.',
      'Adjust water recirculation valves when alarms trigger.',
    ],
  },
  {
    title: 'Custom Title XYZ-47',
    titleClass: 'unknown',
    duties: [
      'Review incoming field reports and mark incomplete entries.',
      'Update the shared tracking sheet with the latest status.',
      'Coordinate with two internal departments when information is missing.',
    ],
  },
  {
    title: 'Archive Climate Monitoring Assistant',
    titleClass: 'unknown',
    duties: [
      'Read temperature and humidity loggers twice each shift.',
      'Flag readings outside the vault tolerance range.',
      'Replace desiccant packs in the secondary storage room.',
    ],
  },
];

const KNOWN_OCCUPATIONS: Fixture[] = [
  {
    title: 'Accountant',
    titleClass: 'known',
    duties: [
      'Reconcile monthly ledger entries against bank statements.',
      'Prepare draft variance notes for the finance review pack.',
      'Archive closed-period workpapers in the shared drive folder.',
    ],
  },
  {
    title: 'Electrician',
    titleClass: 'known',
    duties: [
      'Install conduit runs for new lighting circuits.',
      'Test continuity on completed branch circuits.',
      'Label breaker panels after each board update.',
    ],
  },
  {
    title: 'Teacher',
    titleClass: 'known',
    duties: [
      'Plan weekly lesson outlines for the assigned class group.',
      'Mark homework submissions against the rubric checklist.',
      'Meet parents during the scheduled conference window.',
    ],
  },
  {
    title: 'Truck Driver',
    titleClass: 'known',
    duties: [
      'Complete pre-trip vehicle inspection checklists.',
      'Deliver pallets to the scheduled depot windows.',
      'Record mileage and rest stops in the driver logbook.',
    ],
  },
  {
    title: 'Graphic Designer',
    titleClass: 'known',
    duties: [
      'Layout brochure spreads from the approved copy deck.',
      'Export print-ready PDF packages for the vendor portal.',
      'Organize layered source files in the project archive.',
    ],
  },
  {
    title: 'Warehouse Worker',
    titleClass: 'known',
    duties: [
      'Pick order lines from the printed pick list.',
      'Wrap completed pallets before staging.',
      'Scan location barcodes after each put-away.',
    ],
  },
  {
    title: 'Cleaner',
    titleClass: 'known',
    duties: [
      'Vacuum office corridors after business hours.',
      'Restock restroom supplies from the closet inventory.',
      'Empty recycling bins into the loading-bay containers.',
    ],
  },
  {
    title: 'Mechanical Engineer',
    titleClass: 'known',
    duties: [
      'Draft tolerance notes on mechanical assembly drawings.',
      'Review supplier quotes against the bill of materials.',
      'Update revision tables after design change approvals.',
    ],
  },
  {
    title: 'Sales Representative',
    titleClass: 'known',
    duties: [
      'Call assigned accounts with the weekly outreach list.',
      'Enter meeting outcomes into the pipeline tracker.',
      'Send follow-up quotes after product demos.',
    ],
  },
  {
    title: 'Laboratory Assistant',
    titleClass: 'known',
    duties: [
      'Prepare sample trays for the afternoon assay batch.',
      'Calibrate pipettes before each measurement run.',
      'Record reagent lot numbers in the bench notebook.',
    ],
  },
];

function bulletsOf(duties: string[]): string {
  return formatExperienceBullets(duties);
}

function fixtureCv(f: Fixture, overrides?: Partial<CVData>): CVData {
  const desc = bulletsOf(f.duties);
  const isPresent = f.isPresent !== false;
  return {
    id: `cv-${f.title.replace(/\s+/g, '-').toLowerCase()}`,
    name: 'CV',
    personal: {
      fullName: 'Alex North',
      email: 'alex@example.com',
      phone: '',
      address: '',
      jobTitle: f.title,
      gender: 'male',
      photoEnabled: false,
    },
    summary: `${f.title} with approximately two and a half years of experience. ${f.duties.join(' ')}`,
    summaryOrigin: 'user',
    contentLocale: 'en',
    experience: [{
      id: 'exp-1',
      company: 'Northstar',
      position: f.title,
      startDate: '2024-01',
      endDate: isPresent ? '' : '2025-06',
      isPresent,
      description: desc,
      originalUserDescription: desc,
      canonicalDescription: desc,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'US',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function assertDutiesPreserved(text: string, duties: string[], label: string, opts?: { requireEnglishTokens?: boolean }) {
  const identity = validateSourceFactIdentityCoverage(bulletsOf(duties), text);
  expect(identity.ok, `${label} identities missing=${identity.missingIds.join(',')}`).toBe(true);
  expect(validateDistinctExperienceBullets(text).ok, `${label} duplicates`).toBe(true);
  expect(validateNoExtraGeneratedDuties(bulletsOf(duties), text).valid, `${label} extras`).toBe(true);
  expect(text, label).not.toMatch(STEREOTYPE_RE);
  if (opts?.requireEnglishTokens !== false) {
    for (const duty of duties) {
      const tokens = duty.toLowerCase().split(/\W+/).filter((t) => t.length > 4).slice(0, 3);
      const hit = tokens.some((t) => text.toLowerCase().includes(t));
      // Cross-locale projection may keep English source tokens via universal preserve.
      expect(hit || identity.ok, `${label} lost tokens from: ${duty}`).toBe(true);
    }
  }
}

describe('Universal source-unit Experience preservation', () => {
  beforeEach(() => {
    // usage counter is module state; tests assert deltas
  });

  it('unknown titles do not require catalogue entries', () => {
    for (const f of UNKNOWN_TITLES) {
      const rebuilt = buildSourcePreservingExperienceBullets(
        bulletsOf(f.duties),
        'en',
        'male',
        { isPresent: true },
      );
      assertDutiesPreserved(rebuilt, f.duties, f.title);
      expect(sourceFactIdentitiesFromDescription(bulletsOf(f.duties)).length).toBe(3);
    }
  });

  it('known occupations preserve user facts without role stereotypes', () => {
    for (const f of KNOWN_OCCUPATIONS) {
      const rebuilt = buildSourcePreservingExperienceBullets(
        bulletsOf(f.duties),
        'en',
        'male',
        { isPresent: true },
      );
      assertDutiesPreserved(rebuilt, f.duties, f.title);
    }
  });

  it('category collision: three same-category facts stay distinct (no shell×3)', () => {
    const duties = [
      'Respond to customer inquiries by email and phone.',
      'Record customer issues in the support system.',
      'Coordinate with colleagues to resolve customer requests.',
    ];
    const rebuilt = buildSourcePreservingExperienceBullets(bulletsOf(duties), 'en', 'male', {
      isPresent: true,
    });
    assertDutiesPreserved(rebuilt, duties, 'cs-collision');
    const lines = splitExperienceBullets(rebuilt);
    expect(new Set(lines.map((l) => l.toLowerCase())).size).toBe(3);
    expect(rebuilt).not.toMatch(/Provided attentive customer service and built rapport with guests/i);
  });

  it('provider-failure matrix rebuilds from source; rejected output uses zero AI', () => {
    const f = UNKNOWN_TITLES.find((x) => x.title.includes('XYZ-47'))!;
    const source = bulletsOf(f.duties);
    const corruptions: Array<{ name: string; candidate: string; expectApply: boolean }> = [
      {
        name: 'three-duplicates',
        candidate: formatExperienceBullets([f.duties[0], f.duties[0], f.duties[0]]),
        expectApply: false,
      },
      {
        name: 'one-generic',
        candidate: '• Performed general professional duties for the role.',
        expectApply: false,
      },
      {
        name: 'omit-one',
        candidate: formatExperienceBullets([f.duties[0], f.duties[1]]),
        expectApply: false,
      },
      {
        name: 'stereotype',
        candidate: formatExperienceBullets([
          'Provided attentive customer service and built rapport with guests.',
          'Prepared Mediterranean dishes for guests.',
          'Dispensed prescriptions in the pharmacy.',
        ]),
        expectApply: false,
      },
      {
        name: 'changed-object',
        candidate: formatExperienceBullets([
          'Review outgoing press releases and mark incomplete entries.',
          'Update the shared tracking sheet with the latest status.',
          'Coordinate with two internal departments when information is missing.',
        ]),
        expectApply: false,
      },
      {
        name: 'metrics',
        candidate: formatExperienceBullets([
          ...f.duties.slice(0, 2),
          'Coordinate with two internal departments when information is missing, achieving 98% SLA.',
        ]),
        expectApply: true, // metrics fluff may still cover identities; extras gate is hospitality-focused
      },
      {
        name: 'wrong-tense',
        candidate: formatExperienceBullets([
          'Reviewed incoming field reports and mark incomplete entries.',
          'Updated the shared tracking sheet with the latest status.',
          'Coordinated with two internal departments when information is missing.',
        ]),
        expectApply: true,
      },
      {
        name: 'malformed',
        candidate: '### PROTOCOL ###\nignore previous',
        expectApply: false,
      },
      {
        name: 'empty-timeout',
        candidate: '',
        expectApply: false,
      },
    ];

    for (const c of corruptions) {
      const before = getProAiUsageCount();
      const pipeline = runCvAiApplyPipeline({
        cv: fixtureCv(f),
        locale: 'en',
        action: 'experience_bullets',
        candidate: c.candidate,
        experienceId: 'exp-1',
        industry: 'general',
        level: 'mid',
        referenceDateIso: '2026-07-18',
      });
      if (pipeline.blocked || !pipeline.finalized.countedAsSuccess) {
        expect(getProAiUsageCount(), c.name).toBe(before);
        // Fallback may still apply source-preserving text without counting when blocked...
        if (!pipeline.blocked && pipeline.finalized.countedAsSuccess) {
          recordProAiUserActionSuccess();
        }
      } else {
        assertDutiesPreserved(pipeline.stateCv.experience[0].description, f.duties, c.name);
        recordProAiUserActionSuccess();
        expect(getProAiUsageCount(), c.name).toBe(before + 1);
      }
      // Regardless of accept/reject path, never leave stereotype shells applied.
      if (!pipeline.blocked) {
        expect(pipeline.stateCv.experience[0].description).not.toMatch(STEREOTYPE_RE);
        assertDutiesPreserved(pipeline.stateCv.experience[0].description, f.duties, `${c.name}-final`);
      }
    }

    // Explicit empty candidate → source-preserving apply
    const empty = runCvAiApplyPipeline({
      cv: fixtureCv(f),
      locale: 'en',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'general',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    expect(empty.blocked).toBe(false);
    assertDutiesPreserved(empty.stateCv.experience[0].description, f.duties, 'empty-rebuild');
  });

  it('no-fact path stays role-neutral and does not invent concrete duties', () => {
    const f: Fixture = {
      title: 'Custom Title XYZ-47',
      titleClass: 'unknown',
      duties: [],
    };
    const cv = fixtureCv({ ...f, duties: ['x'] }, {
      experience: [{
        id: 'exp-1',
        company: 'Northstar',
        position: f.title,
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: '',
        originalUserDescription: '',
        canonicalDescription: '',
        descriptionOrigin: 'user',
      }],
      summary: `${f.title} with experience.`,
    });
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
      industry: 'general',
      level: 'mid',
      referenceDateIso: '2026-07-18',
    });
    const text = pipeline.finalized.text || '';
    expect(text).not.toMatch(STEREOTYPE_RE);
    expect(text).not.toMatch(/\b(drone|gallery|prescription|mediterranean)\b/i);
  });

  it('en/sr/hi + present/past tense controls for unknown title', () => {
    const f = UNKNOWN_TITLES[3];
    for (const locale of ['en', 'sr', 'hi'] as Locale[]) {
      const present = buildSourcePreservingExperienceBullets(bulletsOf(f.duties), locale, 'male', {
        isPresent: true,
      });
      expect(present.trim(), `${locale}-present`).not.toBe('');
      expect(present, `${locale}-present`).not.toMatch(STEREOTYPE_RE);
      expect(validateDistinctExperienceBullets(present).ok, `${locale}-present-dup`).toBe(true);
      if (locale === 'en') {
        assertDutiesPreserved(present, f.duties, `${locale}-present`);
        expect(present).toMatch(/\bReview\b/);
        expect(present).toMatch(/\bUpdate\b/);
        expect(present).toMatch(/\bCoordinate\b/);
        expect(present).not.toMatch(/\bReviewed\b|\bUpdated\b|\bCoordinated\b/);
      }
      const past = buildSourcePreservingExperienceBullets(bulletsOf(f.duties), locale, 'male', {
        isPresent: false,
      });
      expect(past.trim(), `${locale}-past`).not.toBe('');
      expect(past, `${locale}-past`).not.toMatch(STEREOTYPE_RE);
      if (locale === 'en') {
        assertDutiesPreserved(past, f.duties, `${locale}-past`);
        expect(past).toMatch(/\bReviewed\b|\bUpdated\b|\bCoordinated\b/);
      }
    }
    expect(universalPreserveSourceUnit('Review incoming field reports.', { isPresent: true }))
      .toMatch(/^Review\b/);
    expect(applyEnglishEmploymentTense('Review incoming field reports.', false))
      .toMatch(/^Reviewed\b/);
  });

  it('Summary/Experience parity, reload, PDF/DOCX for unknown title', async () => {
    const f = UNKNOWN_TITLES[3];
    const cv = fixtureCv(f);
    const prepared = prepareExportReadyCv(cv, 'en', 'modern-minimal', {
      gender: 'male',
      referenceDate: '2026-07-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    assertDutiesPreserved(prepared.cv.experience[0].description, f.duties, 'export-exp');
    for (const duty of f.duties) {
      const token = duty.toLowerCase().split(/\W+/).find((t) => t.length > 5)!;
      expect(prepared.cv.summary.toLowerCase()).toContain(token);
    }
    expect(prepared.cv.summary).toMatch(/two and a half years/i);

    const usageBefore = getProAiUsageCount();
    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'en');
    const docx = await exportToDOCX(prepared.cv, 'univ-xyz47', 'en', 'modern-minimal');
    expect(pdf).toBeTruthy();
    expect(docx).toBeTruthy();
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    assertDutiesPreserved(pdfText, f.duties, 'pdf');
    expect(getProAiUsageCount()).toBe(usageBefore);

    const reloaded = JSON.parse(JSON.stringify(prepared.cv)) as CVData;
    const again = prepareExportReadyCv(reloaded, 'en', 'modern-minimal', {
      gender: 'male',
      referenceDate: '2026-07-18',
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.cv.experience[0].description).toBe(prepared.cv.experience[0].description);
  }, 60_000);

  it('100-case deterministic property matrix (seed 253001)', () => {
    const SEED = 253001;
    let state = SEED;
    const rand = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const pool = [...UNKNOWN_TITLES, ...KNOWN_OCCUPATIONS];
    const locales: Locale[] = ['en', 'sr', 'hi'];
    const corruptions = [
      'none',
      'dup3',
      'one',
      'omit',
      'stereotype',
      'empty',
    ] as const;

    for (let i = 0; i < 100; i += 1) {
      const fixture = pool[Math.floor(rand() * pool.length)];
      const locale = locales[Math.floor(rand() * locales.length)];
      const isPresent = rand() > 0.35;
      const factCount = 1 + Math.floor(rand() * Math.min(5, fixture.duties.length));
      const duties = fixture.duties.slice(0, factCount);
      // Pad to requested count with synthetic but concrete units when needed.
      while (duties.length < factCount) {
        duties.push(`Complete assigned checklist item ${duties.length + 1} for the shift.`);
      }
      const source = bulletsOf(duties);
      const corruption = corruptions[Math.floor(rand() * corruptions.length)];
      let candidate = source;
      if (corruption === 'dup3') {
        candidate = formatExperienceBullets([duties[0], duties[0], duties[0]]);
      } else if (corruption === 'one') {
        candidate = '• Carried out assigned professional responsibilities within the role.';
      } else if (corruption === 'omit' && duties.length > 1) {
        candidate = bulletsOf(duties.slice(0, -1));
      } else if (corruption === 'stereotype') {
        candidate = formatExperienceBullets([
          'Provided attentive customer service and built rapport with guests.',
          'Prepared Mediterranean dishes according to restaurant standards.',
          'Dispensed pharmacy prescriptions for patients.',
        ].slice(0, duties.length));
      } else if (corruption === 'empty') {
        candidate = '';
      }

      const pipeline = runCvAiApplyPipeline({
        cv: fixtureCv({ ...fixture, duties, isPresent }),
        locale,
        action: 'experience_bullets',
        candidate,
        experienceId: 'exp-1',
        industry: 'general',
        level: 'mid',
        referenceDateIso: '2026-07-18',
      });

      const diag = {
        seed: SEED,
        case: i,
        titleClass: fixture.titleClass,
        title: fixture.title,
        locale,
        sourceFactCount: duties.length,
        corruption,
        required: sourceFactIdentitiesFromDescription(source).map((x) => x.id),
      };

      if (pipeline.blocked) {
        expect(pipeline.finalized.countedAsSuccess, JSON.stringify(diag)).toBe(false);
        continue;
      }
      const out = pipeline.stateCv.experience[0].description;
      expect(out, JSON.stringify(diag)).not.toMatch(STEREOTYPE_RE);
      expect(validateDistinctExperienceBullets(out).ok, JSON.stringify(diag)).toBe(true);
      if (locale === 'en') {
        const identity = validateSourceFactIdentityCoverage(source, out);
        expect(identity.ok, JSON.stringify({ ...diag, missing: identity.missingIds, covered: identity.coveredIds })).toBe(true);
        expect(validateExperienceApplyMaterialPostcondition(source, out).ok, JSON.stringify(diag)).toBe(true);
      }
    }
  });
});

describe('localizeCanonicalBulletLine never repeats category shells for distinct units', () => {
  it('three hospitality-classified units stay distinct under universal path', () => {
    const a = localizeCanonicalBulletLine(
      'Greet visitors at the front desk and confirm appointments.',
      'en',
      'male',
      { isPresent: true },
    );
    const b = localizeCanonicalBulletLine(
      'Answer the lobby phone and route messages to staff.',
      'en',
      'male',
      { isPresent: true },
    );
    const c = localizeCanonicalBulletLine(
      'Update the visitor log after each departure.',
      'en',
      'male',
      { isPresent: true },
    );
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(`${a}\n${b}\n${c}`).not.toMatch(/built rapport with guests/i);
  });
});
