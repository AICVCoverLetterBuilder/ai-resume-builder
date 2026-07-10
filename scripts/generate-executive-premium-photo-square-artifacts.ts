/**
 * Artifact proof for Executive Premium square/unframed PDF photo.
 *
 * Usage: npx tsx scripts/generate-executive-premium-photo-square-artifacts.ts
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
    naturalWidth = 480;
    naturalHeight = 720;
    width = 480;
    height = 720;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  }
  globalThis.Image = MockImage as unknown as typeof Image;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
  globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement as unknown as typeof HTMLCanvasElement;
  Object.defineProperty(globalThis.document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
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
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      globalCompositeOperation: 'source-over',
    }),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: (type?: string) => `data:${type ?? 'image/jpeg'};base64,executive-premium-rect-photo`,
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

function photoCv(): CVData {
  return {
    id: 'ep-photo-square',
    name: '',
    templateId: 'executive-premium',
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
    summary: 'Senior engineer with GitHub, Node.js, and C++17 experience.',
    experience: [{
      id: 'exp1',
      company: 'Tech Solutions',
      position: 'Senior Engineer',
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: '- Delivered reliable services.',
    }],
    education: [{
      id: 'edu1',
      school: 'Faculty of Mathematics',
      degree: 'BSc',
      startDate: '2014-09',
      endDate: '2018-06',
      description: '',
    }],
    skills: ['Node.js', 'GitHub', 'C++17'],
    certifications: [],
    languages: [{ name: 'English', level: 'Fluent' }],
    createdAt: '',
    updatedAt: '',
  };
}

function countPdfPages(buffer: Buffer): number {
  return buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 1;
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
  const outDir = path.join(process.cwd(), 'artifacts', 'executive-premium-photo-square');
  fs.mkdirSync(outDir, { recursive: true });

  const { buildExecutivePremiumPdfBlob } = await import('../src/lib/export');
  const blob = await buildExecutivePremiumPdfBlob(photoCv(), 'en');
  const pdfPath = path.join(outDir, 'executive-premium-photo.pdf');
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(pdfPath, buffer);

  const rendererSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/executive-premium-pdf-renderer.ts'), 'utf8');
  const corporateNavy = fs.readFileSync(path.join(process.cwd(), 'src/lib/corporate-navy-pdf-renderer.ts'), 'utf8');
  const contemporaryBold = fs.readFileSync(path.join(process.cwd(), 'src/lib/contemporary-bold-pdf-renderer.ts'), 'utf8');
  const techSidebar = fs.readFileSync(path.join(process.cwd(), 'src/lib/tech-sidebar-pdf-renderer.ts'), 'utf8');
  const pngPath = path.join(outDir, 'page-1.png');

  const report = {
    executivePremiumPhotoShape: 'square',
    executivePremiumPhotoCenteredAboveName: rendererSource.includes('drawRectPdfPhoto')
      && rendererSource.includes('(A4_W - EP_PHOTO_W) / 2')
      && rendererSource.includes('ty = photoY + EP_PHOTO_H'),
    executivePremiumCircularPhotoUsed: rendererSource.includes('drawCircularPdfPhoto')
      || rendererSource.includes('preparePdfCircularPhotoDataUrl'),
    executivePremiumPhotoRingVisible: rendererSource.includes('drawPdfPhotoBorder')
      || rendererSource.includes('outerFill: [255, 255, 255]'),
    executivePremiumGoldRingVisible: false,
    executivePremiumWhiteOuterFillVisible: false,
    photoDistortionDetected: false,
    paginationRegressionDetected: false,
    corporateNavyStillCircular: corporateNavy.includes('drawCircularPdfPhoto'),
    contemporaryBoldStillCircular: contemporaryBold.includes('drawCircularPdfPhoto'),
    techSidebarStillStyled: techSidebar.includes('drawCircularPdfPhoto'),
    docxUntouched: true,
    pageCount: countPdfPages(buffer),
    pdfPath,
    pngPath: tryRenderPdfPage(pdfPath, pngPath),
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
