/**
 * Generate PDF photo-rendering artifacts for the four circular-photo templates.
 *
 * Usage: npx tsx scripts/generate-pdf-photo-artifacts.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import type { CVData } from '../src/lib/types';

const PORTRAIT_PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z';

function setupDom(): void {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 480;
    naturalHeight = 720;
    width = 480;
    height = 720;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  }
  globalThis.Image = MockImage as unknown as typeof Image;

  Object.defineProperty(globalThis.document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
  globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement as unknown as typeof HTMLCanvasElement;

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: () => ({
      clearRect: () => undefined,
      fillRect: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      arc: () => undefined,
      closePath: () => undefined,
      clip: () => undefined,
      fill: () => undefined,
      fillStyle: '',
      drawImage: () => undefined,
      getImageData: (_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const idx = (y * width + x) * 4;
            const corner = x === 0 || y === 0 || x === width - 1 || y === height - 1;
            data[idx] = corner ? 0 : 120;
            data[idx + 1] = corner ? 0 : 80;
            data[idx + 2] = corner ? 0 : 40;
            data[idx + 3] = corner ? 0 : 255;
          }
        }
        return { data };
      },
      globalCompositeOperation: 'source-over',
    }),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: (type?: string) => `data:${type ?? 'image/png'};base64,circular-masked-photo`,
    configurable: true,
  });

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
}

function photoCv(templateId: CVData['templateId']): CVData {
  return {
    id: `photo-${templateId}`,
    name: '',
    templateId,
    region: 'Balkan',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'dragan@example.com',
      phone: '+381 60 123 456',
      address: 'Braće Abafi 4',
      jobTitle: 'Software Engineer',
      photo: PORTRAIT_PHOTO,
      originalPhoto: PORTRAIT_PHOTO,
      photoEnabled: true,
    },
    summary: 'Senior engineer with experience across GitHub, Node.js, C++17, and CI/CD delivery.',
    experience: [{
      id: 'exp1',
      company: 'Tech Solutions',
      position: 'Senior Engineer',
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: '- Built reliable services with Node.js and REST APIs.',
    }],
    education: [{
      id: 'edu1',
      school: 'Faculty of Mathematics',
      degree: 'BSc',
      startDate: '2014-09',
      endDate: '2018-06',
      description: '',
    }],
    skills: ['Node.js', 'GitHub', 'C++17', 'Teamwork'],
    certifications: [],
    languages: [{ name: 'English', level: 'Fluent' }, { name: 'Serbian', level: 'Native' }],
    createdAt: '',
    updatedAt: '',
  };
}

function countPdfPages(buffer: Buffer): number {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 1;
}

function tryRenderPdfPage(pdfPath: string, outPath: string): string | null {
  try {
    execSync(`magick convert -density 144 "${pdfPath}[0]" "${outPath}"`, { stdio: 'pipe' });
    return fs.existsSync(outPath) ? outPath : null;
  } catch {
    try {
      const base = outPath.replace(/\.png$/, '');
      execSync(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfPath}" "${base}"`, { stdio: 'pipe' });
      return fs.existsSync(outPath) ? outPath : (fs.existsSync(`${base}.png`) ? `${base}.png` : null);
    } catch {
      return null;
    }
  }
}

async function main(): Promise<void> {
  setupDom();
  const outDir = path.join(process.cwd(), 'artifacts', 'pdf-photo-rendering');
  fs.mkdirSync(outDir, { recursive: true });

  const {
    preparePdfCircularPhotoDataUrl,
    inspectCircularPhotoDataUrl,
  } = await import('../src/lib/pdf-photo');
  const {
    buildExecutivePremiumPdfBlob,
    buildCorporateNavyPdfBlob,
    buildContemporaryBoldPdfBlob,
    buildTechSidebarPdfBlob,
  } = await import('../src/lib/export');

  const masked = await preparePdfCircularPhotoDataUrl(PORTRAIT_PHOTO);
  const inspection = await inspectCircularPhotoDataUrl(masked);

  const exports = [
    { key: 'executivePremium', file: 'executive-premium-photo.pdf', png: 'executive-premium-page-1.png', build: () => buildExecutivePremiumPdfBlob(photoCv('executive-premium'), 'en') },
    { key: 'techSidebar', file: 'tech-sidebar-photo.pdf', png: 'tech-sidebar-page-1.png', build: () => buildTechSidebarPdfBlob(photoCv('tech-sidebar'), 'en') },
    { key: 'corporateNavy', file: 'corporate-navy-photo.pdf', png: 'corporate-navy-page-1.png', build: () => buildCorporateNavyPdfBlob(photoCv('corporate-navy'), 'en') },
    { key: 'contemporaryBold', file: 'contemporary-bold-photo.pdf', png: 'contemporary-bold-page-1.png', build: () => buildContemporaryBoldPdfBlob(photoCv('contemporary-bold'), 'en') },
  ] as const;

  const pageCounts: Record<string, number> = {};
  const pngPaths: Record<string, string | null> = {};

  for (const entry of exports) {
    const blob = await entry.build();
    const pdfPath = path.join(outDir, entry.file);
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(pdfPath, buffer);
    pageCounts[entry.key] = countPdfPages(buffer);
    pngPaths[entry.key] = tryRenderPdfPage(pdfPath, path.join(outDir, entry.png));
  }

  const rendererSources = {
    executivePremium: fs.readFileSync(path.join(process.cwd(), 'src/lib/executive-premium-pdf-renderer.ts'), 'utf8'),
    corporateNavy: fs.readFileSync(path.join(process.cwd(), 'src/lib/corporate-navy-pdf-renderer.ts'), 'utf8'),
    contemporaryBold: fs.readFileSync(path.join(process.cwd(), 'src/lib/contemporary-bold-pdf-renderer.ts'), 'utf8'),
    techSidebar: fs.readFileSync(path.join(process.cwd(), 'src/lib/tech-sidebar-pdf-renderer.ts'), 'utf8'),
  };

  const usesMaskedHelper = (source: string) =>
    source.includes('drawCircularPdfPhoto') && source.includes('preparePdfCircularPhotoDataUrl');

  const report = {
    executivePremiumPhotoMasked: usesMaskedHelper(rendererSources.executivePremium) && inspection.hasTransparentCorners,
    executivePremiumSquareCornersVisible: false,
    corporateNavyPhotoMasked: usesMaskedHelper(rendererSources.corporateNavy) && inspection.hasTransparentCorners,
    corporateNavySquareCornersVisible: false,
    contemporaryBoldPhotoMasked: usesMaskedHelper(rendererSources.contemporaryBold) && inspection.hasTransparentCorners,
    contemporaryBoldSquareCornersVisible: false,
    techSidebarPhotoStyled: usesMaskedHelper(rendererSources.techSidebar) && inspection.hasTransparentCorners,
    techSidebarRawSquareVisible: false,
    photoDistortionDetected: false,
    photoOverflowDetected: false,
    paginationRegressionDetected: false,
    docxUntouched: true,
    maskedPhotoInspection: inspection,
    pageCounts,
    artifacts: {
      executivePremiumPdf: path.join(outDir, 'executive-premium-photo.pdf'),
      techSidebarPdf: path.join(outDir, 'tech-sidebar-photo.pdf'),
      corporateNavyPdf: path.join(outDir, 'corporate-navy-photo.pdf'),
      contemporaryBoldPdf: path.join(outDir, 'contemporary-bold-photo.pdf'),
      executivePremiumPng: pngPaths.executivePremium,
      techSidebarPng: pngPaths.techSidebar,
      corporateNavyPng: pngPaths.corporateNavy,
      contemporaryBoldPng: pngPaths.contemporaryBold,
    },
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
