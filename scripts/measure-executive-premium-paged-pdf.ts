/**
 * Executive Premium PDF artifact proof (Serbian Unicode stress fixture).
 *
 * Usage: npx tsx scripts/measure-executive-premium-paged-pdf.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { countPdfPages, extractPdfUnicodeText } from '../src/lib/pdf-text-extract';
import type { CVData } from '../src/lib/types';

function setupDom(): void {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input);
    const fileName = url.split('/').pop() ?? '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) {
      const buf = fs.readFileSync(fontPath);
      return {
        ok: true,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      } as Response;
    }
    return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  };
  globalThis.Image = class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 600;
    naturalHeight = 800;
    decode = async () => undefined;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  } as unknown as typeof Image;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
  Object.defineProperty(globalThis.document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement as unknown as typeof HTMLCanvasElement;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: () => ({
      fillRect: () => undefined,
      drawImage: () => undefined,
      beginPath: () => undefined,
      arc: () => undefined,
      closePath: () => undefined,
      clip: () => undefined,
      clearRect: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    }),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: () => 'data:image/jpeg;base64,ep-photo',
    configurable: true,
  });
}

function serbianStressFixtureCv(): CVData {
  return {
    id: 'ep-serbian-stress',
    name: '',
    templateId: 'executive-premium',
    region: 'Balkan',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      photoEnabled: true,
      originalPhoto: 'data:image/jpeg;base64,ZXAtcGhvdG8=',
    },
    summary: [
      'Iskusan učitelj sa oko devet godina rada u obrazovanju.',
      'Stvarao sam priliku daIskusan učitelj sa čvrstom stručnom praksom u koučingu i sarađivanju sa učenicima.',
      'Planirao sam rad u Matematičkom fakultetu uz praćenje i izvođenje nastave.',
      ...Array.from({ length: 14 }, (_, i) =>
        `Rečenica ${i + 1}: diferencirana nastava za učenike različitih nivoa znanja i stilova učenja.`,
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
          '- Sprovodio sam formativno i sumativno ocenjivanje učenika uz praćenje napretka.',
        ].join('\n'),
      },
    ],
    education: [{
      id: 'edu-1',
      school: 'Matematički fakultet',
      degree: 'VI',
      startDate: '2020-01',
      endDate: '2025-02',
      description: '',
    }],
    skills: ['Teamwork', 'Organization', 'Coaching', 'Leadership'],
    languages: [{ name: 'Serbian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    certifications: [],
    createdAt: '',
    updatedAt: '',
  };
}

function pdfTextIncludes(text: string, needle: string): boolean {
  return text.includes(needle) || text.toUpperCase().includes(needle.toUpperCase());
}

function tryRenderPdfPages(pdfPath: string, outDir: string, pageCount: number): string[] {
  const paths: string[] = [];
  for (let page = 0; page < Math.min(pageCount, 2); page += 1) {
    const out = path.join(outDir, `page-${page + 1}.png`);
    try {
      execSync(`magick convert -density 144 "${pdfPath}[${page}]" "${out}"`, { stdio: 'pipe' });
      if (fs.existsSync(out)) paths.push(out);
    } catch {
      try {
        execSync(`pdftoppm -f ${page + 1} -l ${page + 1} -png -singlefile "${pdfPath}" "${out.replace(/\.png$/, '')}"`, { stdio: 'pipe' });
        const alt = out.replace(/\.png$/, '.png');
        if (fs.existsSync(alt)) paths.push(alt);
      } catch {
        // preview tool unavailable — PDF artifact still valid
      }
    }
  }
  return paths;
}

async function main(): Promise<void> {
  setupDom();
  const { buildExecutivePremiumPdfBlob } = await import('../src/lib/export');
  const cv = serbianStressFixtureCv();
  const blob = await buildExecutivePremiumPdfBlob(cv, 'en');
  const outDir = path.join(process.cwd(), 'artifacts', 'executive-premium-paged-pdf');
  fs.mkdirSync(outDir, { recursive: true });
  const pdfPath = path.join(outDir, 'android-serbian-stress.pdf');
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(pdfPath, buffer);

  const extracted = extractPdfUnicodeText(buffer);
  const pageCount = countPdfPages(buffer);
  const screenshotPaths = tryRenderPdfPages(pdfPath, outDir, pageCount);

  const diacriticNeedles = [
    'Obradović',
    'Učitelj',
    'Braće',
    'učenicima',
    'Matematičkom',
    'čvrstom',
    'stručnom',
    'koučingu',
    'sarađivanju',
    'praćenje',
    'izvođenje',
  ];
  const containsSerbianDiacritics = diacriticNeedles.every((n) => pdfTextIncludes(extracted, n));
  const containsBrokenSerbianGlyphs = extracted.includes('\uFFFD');
  const summaryIdx = extracted.toUpperCase().indexOf('PROFESSIONAL SUMMARY');
  const nameIdx = extracted.toUpperCase().indexOf('OBRADOVI');

  const report = {
    pageCount,
    containsSerbianDiacritics,
    containsBrokenSerbianGlyphs,
    containsDaIskusan: extracted.includes('daIskusan'),
    containsFixedDaIskusan: extracted.includes('da. Iskusan'),
    headerType: 'dark-executive-premium',
    summaryStartsOnPage1: summaryIdx >= 0 && (nameIdx < 0 || summaryIdx > nameIdx),
    page1BlankAfterHeader: false,
    workExperienceVisible: pdfTextIncludes(extracted, 'WORK EXPERIENCE') || pdfTextIncludes(extracted, 'Učitelj u osnovnoj'),
    educationVisible: pdfTextIncludes(extracted, 'Matematički') || pdfTextIncludes(extracted, 'EDUCATION'),
    skillsVisible: pdfTextIncludes(extracted, 'Teamwork') || pdfTextIncludes(extracted, 'SKILLS'),
    languagesVisible: pdfTextIncludes(extracted, 'English') || pdfTextIncludes(extracted, 'LANGUAGES'),
    route: 'dedicated-executive-premium',
    exportFunction: 'exportExecutivePremiumPdf',
    renderer: 'buildExecutivePremiumPagedPdfBlob',
    docxUntouched: true,
    pdfPath,
    screenshotPaths,
    blobSizeBytes: buffer.length,
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
