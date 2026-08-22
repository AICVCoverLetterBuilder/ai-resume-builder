import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCvSimpleV1Enabled } from '@/lib/cv-simple-v1';

const pageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/cv-builder/page.tsx'),
  'utf8',
);
const modelSource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/cv-render-model-simple-v1.ts'),
  'utf8',
);
const exportSource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/export.ts'),
  'utf8',
);
const corporateRendererSource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/corporate-navy-pdf-renderer.ts'),
  'utf8',
);

function handler(name: string, nextName: string): string {
  const start = pageSource.indexOf(name);
  const end = pageSource.indexOf(nextName, start);
  return pageSource.slice(start, end);
}

describe('Simple V1 M3 Preview/PDF/DOCX routing boundary', () => {
  it('19. Preview selects the shared model before every legacy presentation dependency', () => {
    const start = pageSource.indexOf('const localizedPreviewPresentation = useMemo');
    const body = pageSource.slice(start, pageSource.indexOf('const localizedPreviewCv', start));
    expect(body).toMatch(/if \(simplePreviewSnapshot\) \{/u);
    expect(body.indexOf('if (simplePreviewSnapshot)'))
      .toBeLessThan(body.indexOf('normalizeLegacyCvRuntime'));
    expect(body).toContain('withCvRenderModelPhoto');
  });

  it('20. Preview blocks the asynchronous legacy recovery path when the flag is ON', () => {
    const effectStart = pageSource.indexOf('if (simpleCvV1Enabled) return;', pageSource.indexOf('prepareFinalLocaleSafeCvRef.current'));
    const effect = pageSource.slice(effectStart, pageSource.indexOf('const handleDOCXDownload', effectStart));
    expect(effect).toContain("prepare(sourceCv, { purpose: 'preview' })");
    expect(effect.indexOf('if (simpleCvV1Enabled) return;'))
      .toBeLessThan(effect.indexOf("prepare(sourceCv, { purpose: 'preview' })"));
  });

  it('21. PDF captures the immutable model and conditionally bypasses final recovery', () => {
    const pdf = handler(
      'const handlePDFDownload = async',
      'const handleTemplateRecommend =',
    );
    expect(pdf).toContain('captureCvRenderSnapshot(exportSourceCv)');
    expect(pdf).toContain('const cvForExport = simplePdfSnapshot?.model');
    expect(pdf).toContain('?? await prepareLegacyPdfCvForExport()');
    expect(pdf).toContain('const liveCv = simplePdfSnapshot?.model ?? pdfResolution.exportCv');
  });

  it('22. DOCX captures the immutable model and conditionally bypasses final recovery', () => {
    const docx = handler(
      'const handleDOCXDownload = async',
      'const handlePDFDownload = async',
    );
    expect(docx).toContain('captureCvRenderSnapshot(resolveCvExportSourceAuthority');
    expect(docx).toMatch(/const cvForExport = simpleDocxSnapshot\?\.model\s*\?\? await prepareFinalLocaleSafeCv\(liveCv\)/u);
    expect(docx).toContain('withCvRenderModelPhoto(simpleDocxSnapshot, photoForExport)');
  });

  it('23. the shared model has no Summary recovery, provider, network, or usage dependency', () => {
    const imports = modelSource.split('\n').filter((line) => line.startsWith('import ')).join('\n');
    expect(imports).not.toMatch(/prepareExportReady|canonical|generated|localized|recovery|provider|ai-|network|usage/iu);
    expect(modelSource).not.toMatch(/fetch\(|\/api\/generate|increment(?:Ai|Summary).*usage/iu);
    expect(modelSource).toContain('summary: getCvSummaryText(cv)');
    expect(modelSource).toContain('contentLocale: getCvContentLocale(cv)');
  });

  it('24. all render surfaces use cv.contentLocale while UI controls retain uiLocale', () => {
    const docx = handler('const handleDOCXDownload = async', 'const handlePDFDownload = async');
    const pdf = handler('const handlePDFDownload = async', 'const handleTemplateRecommend =');
    expect(pageSource).toContain('const previewRenderLocale = simplePreviewSnapshot?.contentLocale ?? locale');
    expect(docx).toContain('const docxRenderLocale = simpleDocxSnapshot?.contentLocale ?? locale');
    expect(pdf).toContain('const pdfRenderLocale = simplePdfSnapshot?.contentLocale ?? locale');
    expect(pageSource).toContain('locale={previewRenderLocale}');
  });

  it('25. Creative Artistic and Corporate Navy receive the already-prepared Simple V1 contract', () => {
    const guards = [exportSource, corporateRendererSource].join('\n');
    expect(guards).toContain('options.alreadyPrepared');
    expect(pageSource).toMatch(/alreadyPrepared: terminalExperiencePresentationReady/u);
    expect(pageSource).toContain('const terminalExperiencePresentationReady = simpleCvV1Enabled ||');
    expect(pageSource).toContain('{ elegantFormalPhoto, experiencePresentationReady }');
    expect(pageSource).toContain('const experiencePresentationReady = simpleCvV1Enabled ||');
  });

  it('26. flag OFF preserves legacy routing and flag ON selects shared authority', () => {
    expect(isCvSimpleV1Enabled('false')).toBe(false);
    expect(isCvSimpleV1Enabled('true')).toBe(true);
    expect(pageSource).toContain(': await prepareFinalLocaleSafeCv({');
    expect(pageSource).toContain('? captureCvRenderSnapshot(exportSourceCv)');
  });
});
