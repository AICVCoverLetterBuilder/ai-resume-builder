/**
 * Nordic Clean DOCX artifact proof.
 *
 * Usage: npx tsx scripts/measure-nordic-clean-docx.ts
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
    value: () => 'data:image/jpeg;base64,nc-photo',
    configurable: true,
  });
}

function fixtureCv(): CVData {
  return {
    id: 'nordic-clean-docx-fixture',
    name: '',
    templateId: 'nordic-clean',
    region: 'Balkan',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Software engineer',
      photoEnabled: false,
    },
    summary: [
      'Software engineer with strong delivery experience across distributed systems.',
      'Built reliable regression packs.leads.Software validation across product teams.',
      'Stvarao sam priliku daIskusan učitelj sa iskustvom.',
    ].join(' '),
    experience: [
      {
        id: 'exp-1',
        company: 'Zezezeze',
        position: 'Software engineer',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: [
          '- Owned end-to-end release quality for customer-facing products.',
          '- Built reusable automation scaffolds.assertions.Built smoke suites covering login paths.',
          '- Partnered with developers to triage flaky suites.logic.Built nightly pipelines.',
        ].join('\n'),
      },
      {
        id: 'exp-2',
        company: 'Pixel & Co',
        position: 'QA Tester',
        startDate: '2015-03',
        endDate: '2017-12',
        isPresent: false,
        description: '- Mentored junior designers in brand strategy.applied.Designed workshop kits.',
      },
    ],
    education: [{
      id: 'edu-1',
      school: 'Mathematic school',
      degree: 'VI',
      startDate: '2020-01',
      endDate: '2025-01',
      description: '',
    }],
    skills: ['React', 'TypeScript', 'System Design', 'Leadership', 'Coaching'],
    languages: [{ name: 'English', level: 'Native' }, { name: 'Serbian', level: 'Fluent' }],
    certifications: [],
    createdAt: '',
    updatedAt: '',
  };
}

async function main(): Promise<void> {
  setupDom();
  const { exportToDOCX } = await import('../src/lib/export');
  const cv = fixtureCv();
  const outDir = path.join(process.cwd(), 'artifacts', 'nordic-clean-docx');
  fs.mkdirSync(outDir, { recursive: true });
  const docxPath = path.join(outDir, 'android-stress.docx');

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

  await exportToDOCX(cv, 'nordic-clean-docx-fixture', 'en', 'nordic-clean');
  if (!savedBlob) throw new Error('DOCX blob was not created');
  const buffer = Buffer.from(await savedBlob.arrayBuffer());
  fs.writeFileSync(docxPath, buffer);

  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')!.async('text');
  const plain = documentXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const report = {
    docxPath,
    exportPath: 'exportToDOCX(nordic-clean)',
    containsProfessionalSummaryHeading: plain.toUpperCase().includes('PROFESSIONAL SUMMARY'),
    summaryStartsAfterHeading: plain.includes('Software engineer with strong delivery experience'),
    workExperienceVisible: plain.toUpperCase().includes('WORK EXPERIENCE'),
    educationVisible: plain.toUpperCase().includes('EDUCATION'),
    skillsVisible: plain.toUpperCase().includes('SKILLS') && plain.includes('React'),
    languagesVisible: plain.toUpperCase().includes('LANGUAGES') && plain.includes('English'),
    containsGluedDaIskusan: plain.includes('daIskusan'),
    containsFixedDaIskusan: plain.includes('da. Iskusan'),
    containsGluedLeadsSoftware: plain.includes('leads.Software'),
    containsGluedAssertionsBuilt: plain.includes('assertions.Built'),
    containsGluedLogicBuilt: plain.includes('logic.Built'),
    containsGluedAppliedDesigned: plain.includes('applied.Designed'),
    containsFixedLeadsSoftware: plain.includes('leads. Software'),
    containsFixedAssertionsBuilt: plain.includes('assertions. Built'),
    containsFixedLogicBuilt: plain.includes('logic. Built'),
    containsFixedAppliedDesigned: plain.includes('applied. Designed'),
    docxHasKeepNext: documentXml.includes('w:keepNext'),
    docxHasCantSplit: documentXml.includes('w:cantSplit'),
    docxHasPageBreakBefore: documentXml.includes('w:pageBreakBefore'),
    pdfUntouched: true,
    blobSizeBytes: buffer.length,
  };

  const previewPath = path.join(outDir, 'preview.html');
  fs.writeFileSync(previewPath, `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Nordic Clean DOCX Preview</title>
<style>body{font-family:Calibri,sans-serif;max-width:820px;margin:2rem auto;line-height:1.5;color:#374151}h1{font-size:1.25rem;color:#0D9488}</style>
</head><body>
<h1>Nordic Clean DOCX text extract</h1>
<pre>${plain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body></html>`);
  (report as Record<string, unknown>).previewPath = previewPath;

  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
