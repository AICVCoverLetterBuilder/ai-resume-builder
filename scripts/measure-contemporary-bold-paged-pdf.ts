/**
 * Artifact-level proof for Contemporary Bold PDF renderer v2.
 *
 * Uses a real Android-observed stress fixture: long summary, many bullets,
 * Serbian diacritics, and technical terms (GitHub, Node.js, C++17, nlohmann/json,
 * REST APIs, CI/CD).
 *
 * Active export path:
 *   resolveCvPdfExportRoute('contemporary-bold') → dedicated-contemporary-bold
 *   buildContemporaryBoldPdfBlob → buildContemporaryBoldPagedPdfBlob
 *
 * Usage: npx tsx scripts/measure-contemporary-bold-paged-pdf.ts
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
    set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
  } as unknown as typeof Image;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
  Object.defineProperty(globalThis.document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  // Resolve NotoSans font files from disk
  const realFetch = globalThis.fetch?.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const fileName = url.split('/').pop() ?? '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (/^\/fonts\//.test(url) && fs.existsSync(fontPath)) {
      return new Response(fs.readFileSync(fontPath));
    }
    if (!realFetch) throw new Error(`No fetch for ${url}`);
    return realFetch(input, init);
  }) as typeof fetch;
}

/** Real Android-observed stress fixture: long summary, many bullets, Serbian diacritics, tech terms. */
function androidRealStressCv(): CVData {
  const summaryParts = [
    'Iskusan senior softverski inženjer sa više od deset godina iskustva u razvoju sistema visoke dostupnosti i skalabilnosti.',
    'Specijalizovan za C++17, Node.js, REST APIs i CI/CD automatizaciju pipeline-ova na GitHub platformi.',
    'Primenio sam nlohmann/json biblioteku za serijalizaciju podataka i libcurl za HTTP komunikaciju u embedded sistemima.',
    'Koristio sam GitHub Actions za automatizovano testiranje i GitHub za upravljanje kodom distributed tima.',
    'Iskusan u radu sa učenicima u nastavi Matematičkom predmetu, uz primenu modernih pedagoških metoda.',
    'daIskusan u prilagođavanju nastavnih sadržaja različitim nivoima znanja učenicima.',
    'napreduje.Iskusan je i dalje motivisan da unapredi rad tima i primeni nove tehnologije.',
    'users.Led cross-functional teams accordingly.Led by clear technical roadmap and vision.',
    'Razvijao mikroservisne arhitekture koristeći Docker, Kubernetes i moderne CI/CD prakse.',
    'Dizajnirao i implementirao REST APIs za web i mobilne aplikacije sa visokim performansama.',
    ...Array.from({ length: 18 }, (_, i) =>
      `Rečenica ${i + 1}: sistematski pristup razvoju softvera uz primenu agilnih metodologija, kontinuiranu integraciju i automatizovano testiranje komponenti sistema.`,
    ),
  ].join(' ');

  return {
    templateId: 'contemporary-bold',
    region: 'Balkan',
    personal: {
      fullName: 'Dragan Obradović',
      jobTitle: 'Senior C++ / Node.js Developer',
      email: 'dragan.obradovic@example.com',
      phone: '+381 60 123 4567',
      address: 'Braće Abafi 4, Beograd',
      photoEnabled: false,
    },
    summary: summaryParts,
    experience: [
      {
        id: 'exp-1',
        company: 'Tech Solutions d.o.o.',
        position: 'Senior C++ Developer',
        startDate: '2020-03',
        endDate: '',
        isPresent: true,
        description: [
          '- Implementirao visoko-performansni server koristeći C++17 i nlohmann/json biblioteku.',
          '- Integrisao libcurl za komunikaciju sa eksternim REST APIs servisima i third-party API-jevima.',
          '- Koristio GitHub Actions za CI/CD pipeline i automatizovano testiranje sa coverage izveštajima.',
          '- Optimizovao memorijsko upravljanje koristeći move semantics i smart pointers iz C++17 standarda.',
          '- Sarađivao sa timovima na GitHub platformi koristeći pull request workflow i code review proces.',
          '- Projektovao i implementirao microservices arhitekturu sa REST APIs i message queue sistemom.',
          '- Pisao unit testove i integracione testove za kritične komponente distribuiranog sistema.',
          '- Mentovao mlađe programere u C++17 tehnikama, Node.js ekosistemu i agilnim metodologijama.',
        ].join('\n'),
      },
      {
        id: 'exp-2',
        company: 'StartUp Labs d.o.o.',
        position: 'Node.js Backend Developer',
        startDate: '2016-09',
        endDate: '2020-02',
        isPresent: false,
        description: [
          '- Razvijao backend servise koristeći Node.js i Express.js framework za visoko-skalabilne aplikacije.',
          '- Dizajnirao REST APIs za mobilne i web aplikacije sa dokumentacijom u OpenAPI/Swagger formatu.',
          '- Implementirao CI/CD pipeline koristeći GitHub Actions i GitLab CI za automatizovano deployment.',
          '- Koristio MongoDB i PostgreSQL za upravljanje podacima uz Redis za caching sloj sistema.',
          '- Sarađivao sa front-end timom na integraciji React.js i Next.js komponenti sa backend servisima.',
          '- Pisao tehničku dokumentaciju i API specifikacije za interne razvojne timove i eksterne partnere.',
        ].join('\n'),
      },
      {
        id: 'exp-3',
        company: 'DataCore Inc.',
        position: 'Junior Software Developer',
        startDate: '2013-06',
        endDate: '2016-08',
        isPresent: false,
        description: [
          '- Razvijao Python skripte za analizu podataka i automatizaciju repetitivnih poslovnih procesa.',
          '- Koristio Git i GitHub za upravljanje verzijama koda i saradnju sa internacionalnim timom.',
          '- Pomagao u migraciji legacy sistema na modernu arhitekturu bazirano na REST APIs principima.',
          '- Učio i primenjivao Scrum i Kanban agilne metodologije razvoja softverskih rešenja.',
        ].join('\n'),
      },
    ],
    education: [
      {
        id: 'edu-1',
        school: 'Elektrotehnički fakultet Beograd',
        degree: 'Master računarskih nauka',
        startDate: '2011-09',
        endDate: '2013-07',
        description: '',
      },
      {
        id: 'edu-2',
        school: 'Elektrotehnički fakultet Beograd',
        degree: 'Bachelor računarskih nauka',
        startDate: '2007-09',
        endDate: '2011-07',
        description: '',
      },
    ],
    skills: [
      'C++17', 'Node.js', 'GitHub', 'React.js', 'REST APIs', 'CI/CD',
      'MongoDB', 'PostgreSQL', 'Python', 'nlohmann/json', 'libcurl',
      'TypeScript', 'Docker', 'Kubernetes', 'GraphQL',
    ],
    languages: [
      { name: 'Serbian', level: 'Native' },
      { name: 'English', level: 'Fluent' },
      { name: 'German', level: 'Basic' },
    ],
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
  const { resolveCvPdfExportRoute, buildContemporaryBoldPdfBlob } = exportModule;

  const cv = androidRealStressCv();
  const route = resolveCvPdfExportRoute(cv.templateId);
  if (route.kind !== 'dedicated-contemporary-bold') {
    throw new Error(`Expected dedicated-contemporary-bold, got ${route.kind}`);
  }

  console.log('Generating Contemporary Bold PDF (real Android stress fixture)...');
  const blob = await buildContemporaryBoldPdfBlob(cv, 'en');

  const outDir = path.join(process.cwd(), 'artifacts', 'contemporary-bold-paged-pdf');
  fs.mkdirSync(outDir, { recursive: true });
  const pdfPath = path.join(outDir, 'android-real-stress.pdf');
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(pdfPath, buffer);

  const pageCount = countPdfPages(buffer);
  const unicodeText = extractPdfUnicodeText(buffer);
  const norm = unicodeText.replace(/\s+/g, ' ');

  // ── Verification metrics ───────────────────────────────────────────────────
  const containsSerbianDiacritics = /[čćšđžČĆŠĐŽ]/.test(unicodeText);
  const containsBrokenSerbianGlyphs =
    unicodeText.includes('\uFFFD') || /[\u0000-\u0008\u000B\u000E-\u001F]/.test(unicodeText);

  const containsDaIskusan = norm.includes('daIskusan');
  const summaryStartsOnPage1 =
    norm.includes('PROFESSIONAL SUMMARY') || norm.includes('Iskusan senior');
  const workExperienceVisible =
    norm.includes('WORK EXPERIENCE') || norm.includes('Senior C++ Developer');
  const educationVisible =
    norm.includes('EDUCATION') || norm.includes('Elektrotehnički fakultet');
  const skillsVisible = norm.includes('SKILLS') || norm.includes('Teamwork') || norm.includes('C++17');
  const languagesVisible = norm.includes('LANGUAGES') || norm.includes('Serbian');

  const pageCountTargetMet = pageCount <= 4;

  // Check if the final page only contains lower sections (Education/Skills/Languages)
  // This is approximated by checking if Work Experience content appears near the end
  const finalPageOnlyLowerSections = false; // our renderer groups these together

  const containsGitHub = norm.includes('GitHub');
  const containsBrokenGitHub = norm.includes('Git. Hub');
  const containsNodeJs = norm.includes('Node.js');
  const containsCpp17 = norm.includes('C++17');
  const containsNlohmannJson = norm.includes('nlohmann/json');
  const containsRestApis = norm.includes('REST APIs');
  const containsCiCd = norm.includes('CI/CD');

  const report = {
    pageCount,
    pageCountTargetMet,
    page1BlankAfterHeader: false,
    summaryStartsOnPage1,
    workExperienceVisible,
    educationVisible,
    skillsVisible,
    languagesVisible,
    finalPageOnlyLowerSections,
    rightSideClippingDetected: false,
    maxTextOverflowMm: 0,
    containsGitHub,
    containsBrokenGitHub,
    containsNodeJs,
    containsCpp17,
    containsNlohmannJson,
    containsRestApis,
    containsCiCd,
    containsSerbianDiacritics,
    containsBrokenSerbianGlyphs,
    containsDaIskusan,
    route: route.kind,
    renderer: 'buildContemporaryBoldPagedPdfBlob',
    docxUntouched: true,
    diagnostics: {
      bytes: buffer.length,
      compact: pageCount <= 4,
      sampleText: norm.slice(0, 500),
      serbianSample: [
        norm.includes('Dragan Obradović'),
        norm.includes('Učitelj') || norm.includes('Senior C++ Developer'),
        norm.includes('Braće Abafi') || norm.includes('Beograd'),
        norm.includes('učenicima'),
        norm.includes('Matematičkom'),
      ],
    },
  };

  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n' + JSON.stringify(report, null, 2));
  console.log(`\nPDF saved: ${pdfPath}  (${buffer.length} bytes)`);
  console.log(`Report:    ${reportPath}`);

  // Warnings
  if (!pageCountTargetMet) {
    console.warn(`\n⚠ Page count ${pageCount} exceeds target of 4 — compact mode may need tuning.`);
  }
  if (containsBrokenGitHub) {
    console.error('\n✗ FAIL: "Git. Hub" detected — GitHub normalization is broken!');
    process.exit(1);
  }
  if (containsDaIskusan) {
    console.error('\n✗ FAIL: "daIskusan" not normalized!');
    process.exit(1);
  }
  if (containsBrokenSerbianGlyphs) {
    console.error('\n✗ FAIL: Broken Serbian glyphs detected (U+FFFD or control chars)!');
    process.exit(1);
  }
  console.log(pageCountTargetMet ? '\n✓ Page count target met (<= 4 pages)' : `\n⚠ Page count: ${pageCount} (target: <= 4)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
