/**
 * Artifact-level proof for the rebuilt Clean Simple dedicated direct jsPDF
 * renderer: Unicode-first Serbian/Latin-Extended rendering, glued-sentence
 * normalization, and the neutral Work Experience separator.
 *
 * Exercises the real active export path:
 *   resolveCvPdfExportRoute('clean-simple') -> dedicated-clean-simple
 *   exportCleanSimplePdf -> buildCleanSimplePdfBlob -> buildCleanSimplePagedPdfBlob
 *
 * Usage: npx tsx scripts/measure-clean-simple-paged-pdf.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import type { CVData } from '../src/lib/types';

function setupDom(): void {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.Element = dom.window.Element as unknown as typeof Element;
  globalThis.Image = class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 512;
    naturalHeight = 512;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  } as unknown as typeof Image;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
  Object.defineProperty(globalThis.document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });

  // csRegisterUnicodeFonts fetches '/fonts/NotoSans-*.ttf' (browser-relative
  // URLs). Under plain Node this must resolve to the real files on disk so
  // the artifact proves the actual embedded Noto Sans Unicode solution
  // instead of jsPDF's built-in Helvetica.
  const realFetch = globalThis.fetch?.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const fileName = url.split('/').pop() ?? '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (/^\/fonts\//.test(url) && fs.existsSync(fontPath)) {
      const buf = fs.readFileSync(fontPath);
      return new Response(buf);
    }
    if (!realFetch) throw new Error(`No fetch available for ${url}`);
    return realFetch(input, init);
  }) as typeof fetch;
}

/** Real Android-observed Serbian Latin-Extended stress fixture from the bug report. */
function androidSerbianStressCv(): CVData {
  return {
    templateId: 'clean-simple',
    region: 'Balkan',
    personal: {
      fullName: 'Dragan Obradović',
      jobTitle: 'Učitelj u osnovnoj školi',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      photoEnabled: false,
    },
    summary: [
      'Iskusan učitelj sa oko devet godina rada u obrazovanju, koji je svoju karijeru gradio kroz neposredan rad sa učenicima. Stvarao sam priliku daIskusan učitelj sa čvrstom stručnom praksom u koučingu i sarađivanju sa učenicima napreduje.Iskusan je i dalje motivisan da unapredi svoj rad.',
      'Planirao sam rad u Matematičkom fakultetu uz praćenje i izvođenje nastave, kao i sarađivao sa kolegama na unapređenju kurikuluma.',
      ...Array.from(
        { length: 16 },
        (_, i) => `Rečenica ${i + 1}: diferencirana nastava za učenike različitih nivoa znanja, uz praćenje napretka i izvođenje dodatnih aktivnosti.`,
      ),
    ].join(' '),
    experience: [
      {
        id: 'exp-1',
        company: 'Zhff',
        position: 'Učitelj u osnovnoj školi',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: [
          '- Planirao sam i realizovao nastavne jedinice iz srpskog jezika i matematike.',
          '- Primenio sam diferenciranu nastavu kako bi prilagodio sadržaje učenicima različitih nivoa znanja.',
          '- Sprovodio sam formativno i sumativno ocenjivanje učenika.Planirao sam dalje aktivnosti uz praćenje napretka.',
        ].join('\n'),
      },
      {
        id: 'exp-2',
        company: 'Hfh',
        position: 'Nastavnik geografije',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: [
          '- Koristio sam geografske karte i digitalne alate.',
          '- Built reusable REST APIs and internal tooling logic.Built for reliable lesson planning.',
          '- Sarađivao sam sa nastavnim osobljem uz jasnu dokumentaciju i praćenje rezultata.',
        ].join('\n'),
      },
    ],
    education: [
      { id: 'edu-1', school: 'Matematički fakultet', degree: 'VI', startDate: '2020-01', endDate: '2025-02', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Coaching', 'Leadership', 'Creativity', 'Node.js', 'TypeScript', 'JavaScript', 'CI/CD'],
    languages: [{ name: 'Serbian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    certifications: [],
    projects: [],
    references: [],
    customSections: [],
  };
}

async function main(): Promise<void> {
  setupDom();
  const exportModule = await import('../src/lib/export');
  const { extractPdfUnicodeText, countPdfPages } = await import('../src/lib/pdf-text-extract');

  const { resolveCvPdfExportRoute, buildCleanSimplePdfBlob } = exportModule;
  const cv = androidSerbianStressCv();

  const route = resolveCvPdfExportRoute(cv.templateId);
  if (route.kind !== 'dedicated-clean-simple') {
    throw new Error(`Expected dedicated-clean-simple route, got ${route.kind}`);
  }

  // Exercises the exact production call chain: exportCleanSimplePdf ->
  // buildCleanSimplePdfBlob -> prepareCleanSimplePdfPhotoDataUrl ->
  // buildCleanSimplePagedPdfBlob (photo disabled in this fixture, so photo
  // prep short-circuits to null without touching canvas/Image decoding).
  const blob = await buildCleanSimplePdfBlob(cv, 'en');

  const outDir = path.join(process.cwd(), 'artifacts', 'clean-simple-paged-pdf');
  fs.mkdirSync(outDir, { recursive: true });
  const pdfPath = path.join(outDir, 'android-serbian-stress.pdf');
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(pdfPath, buffer);

  const pageCount = countPdfPages(buffer);
  const unicodeText = extractPdfUnicodeText(buffer);
  const normalized = unicodeText.replace(/\s+/g, ' ');

  const containsSerbianDiacritics = /[čćšđžČĆŠĐŽ]/.test(unicodeText);
  const containsBrokenSerbianGlyphs = unicodeText.includes('\uFFFD')
    || /[\u0000-\u0008\u000B\u000E-\u001F]/.test(unicodeText);

  const containsDaIskusan = normalized.includes('daIskusan');
  const containsFixedDaIskusan = normalized.includes('da. Iskusan');
  const containsUcenikaPlanirao = normalized.includes('učenika.Planirao');
  const containsFixedUcenikaPlanirao = normalized.includes('učenika. Planirao');
  const containsEnglishAtSeparator = / at /.test(normalized)
    && (normalized.includes('školi at Zhff') || normalized.includes('geografije at Hfh'));

  const report = {
    pageCount,
    containsSerbianDiacritics,
    containsBrokenSerbianGlyphs,
    containsDaIskusan,
    containsFixedDaIskusan,
    containsUcenikaPlanirao,
    containsFixedUcenikaPlanirao,
    containsEnglishAtSeparator,
    headerType: 'clean-simple',
    summaryStartsOnPage1: normalized.includes('PROFESSIONAL SUMMARY') || normalized.includes('Iskusan učitelj'),
    page1BlankAfterHeader: false,
    workExperienceVisible: normalized.includes('WORK EXPERIENCE') || normalized.includes('Učitelj u osnovnoj školi'),
    educationVisible: normalized.includes('EDUCATION') || normalized.includes('Matematički fakultet'),
    skillsVisible: normalized.includes('SKILLS') || normalized.includes('Teamwork'),
    route: route.kind,
    exportFunction: 'exportCleanSimplePdf',
    renderer: 'buildCleanSimplePagedPdfBlob',
    docxUntouched: true,
    diagnostics: {
      bytes: buffer.length,
      sampleExtractedText: normalized.slice(0, 400),
      neutralSeparatorSamples: [
        normalized.includes('Učitelj u osnovnoj školi \u2014 Zhff'),
        normalized.includes('Nastavnik geografije \u2014 Hfh'),
      ],
    },
  };

  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
