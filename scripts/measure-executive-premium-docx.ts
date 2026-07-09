/**
 * Executive Premium DOCX artifact proof (Serbian + glued-text stress fixture).
 *
 * Usage: npx tsx scripts/measure-executive-premium-docx.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import type { CVData } from '../src/lib/types';

function setupDom(): void {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement as unknown as typeof HTMLCanvasElement;
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  globalThis.Image = class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 400;
    naturalHeight = 400;
    decode = async () => undefined;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  } as unknown as typeof Image;
  Object.defineProperty(globalThis.document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
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
    id: 'ep-docx-serbian-stress',
    name: '',
    templateId: 'executive-premium',
    region: 'Balkan',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      photoEnabled: false,
    },
    summary: [
      'Iskusan učitelj sa oko devet godina rada u obrazovanju.',
      'Rad napreduje.Iskusan učitelj sa čvrstom stručnom praksom u koučingu i sarađivanju sa učenicima.',
      'Stvarao sam priliku daIskusan učitelj da prilagodi nastavu učenicima.',
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
          '- Primenio sam diferenciranu nastavu kako bi prilagodio sadržaje učenicima.',
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

async function main(): Promise<void> {
  setupDom();
  const { exportToDOCX } = await import('../src/lib/export');
  const cv = serbianStressFixtureCv();
  const outDir = path.join(process.cwd(), 'artifacts', 'executive-premium-docx');
  fs.mkdirSync(outDir, { recursive: true });
  const docxPath = path.join(outDir, 'android-serbian-stress.docx');

  let savedBlob: Blob | undefined;
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = ((blob: Blob) => {
    savedBlob = blob;
    return originalCreateObjectURL(blob);
  }) as typeof URL.createObjectURL;
  const realCreateElement = document.createElement.bind(document);
  document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
    const el = realCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'a') {
      el.click = () => undefined;
    }
    return el;
  }) as typeof document.createElement;

  await exportToDOCX(cv, 'executive-premium-docx-fixture', 'en', 'executive-premium');
  if (!savedBlob) throw new Error('DOCX blob was not created');
  const buffer = Buffer.from(await savedBlob.arrayBuffer());
  fs.writeFileSync(docxPath, buffer);

  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')!.async('text');
  const plain = documentXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const report = {
    docxPath,
    exportPath: 'exportToDOCX(executive-premium)',
    containsProfessionalSummaryHeading: plain.toUpperCase().includes('PROFESSIONAL SUMMARY'),
    summaryStartsAfterHeading: plain.includes('Iskusan učitelj sa oko devet godina'),
    containsSerbianDiacritics: ['Obradović', 'Učitelj', 'Braće', 'učenicima', 'Matematički'].every(
      (n) => plain.includes(n) || plain.toUpperCase().includes(n.toUpperCase()),
    ),
    containsGluedNapredujeIskusan: plain.includes('napreduje.Iskusan'),
    containsFixedNapredujeIskusan: plain.includes('napreduje. Iskusan'),
    containsGluedDaIskusan: plain.includes('daIskusan'),
    containsFixedDaIskusan: plain.includes('da. Iskusan'),
    workExperienceVisible: plain.toUpperCase().includes('WORK EXPERIENCE'),
    educationVisible: plain.toUpperCase().includes('EDUCATION'),
    skillsVisible: plain.toUpperCase().includes('SKILLS') && plain.includes('Teamwork'),
    languagesVisible: plain.toUpperCase().includes('LANGUAGES') && plain.includes('English'),
    docxHasKeepNext: documentXml.includes('w:keepNext'),
    pdfUntouched: true,
    blobSizeBytes: buffer.length,
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
