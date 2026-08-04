import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// @ts-expect-error The audit harness uses the installed jsdom runtime; this repo does not ship @types/jsdom.
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, test } from 'vitest';
import { templateComponents } from '@/components/cv-templates';
import {
  buildAtsStandardPdfBlob,
  buildCleanSimplePdfBlob,
  buildCorporateNavyPdfBlob,
  buildContemporaryBoldPdfBlob,
  buildElegantFormalPdfBlob,
  buildExecutivePremiumPdfBlob,
  buildRirekishoPdfBlob,
  buildTechSidebarPdfBlob,
} from '@/lib/export';
import {
  beginPdfI18nPlacementTracking,
  endPdfI18nPlacementTracking,
} from '@/lib/pdf-i18n-text';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import type { CVData, TemplateId } from '@/lib/types';

const CERTIFICATION = 'AAB-395 Reliability Architecture Certification';

function auditCv(templateId: TemplateId): CVData {
  return {
    id: `aab395-regression-${templateId}`,
    name: 'AAB-395 regression',
    templateId,
    region: 'EU',
    personal: {
      fullName: 'Alex Morgan — Principal International Reliability Programme Lead',
      email: 'audit.aab395@example.test',
      phone: '+381 60 555 0142',
      address: 'International Research and Delivery Campus, Building 42, Suite 1807',
      jobTitle: 'Senior Platform Engineer — Distributed Reliability and International Delivery',
      photoEnabled: false,
    },
    summary: 'Platform engineer who builds reliable services and improves delivery quality.',
    summaryOrigin: 'user',
    canonicalSummary: 'Platform engineer who builds reliable services and improves delivery quality.',
    experience: [{
      id: 'exp-1',
      company: 'Northstar Systems',
      position: 'Senior Platform Engineer',
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: '- Designed reliable services.\n- Documented operational decisions.',
      canonicalDescription: '- Designed reliable services.\n- Documented operational decisions.',
      originalUserDescription: '- Designed reliable services.\n- Documented operational decisions.',
      descriptionOrigin: 'user',
    }],
    education: [{
      id: 'edu-1',
      school: 'Metropolitan Institute of Technology',
      degree: 'Master of Computer Science',
      startDate: '2012',
      endDate: '2014',
      description: '',
    }],
    skills: ['Node.js', 'TypeScript', 'Reliability Engineering'],
    certifications: [CERTIFICATION, `${CERTIFICATION} Advanced`],
    languages: [{ name: 'English', level: 'Native' }, { name: 'Serbian', level: 'Advanced' }],
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  };
}

beforeAll(() => {
  if (typeof document === 'undefined') {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    globalThis.window = dom.window as unknown as Window & typeof globalThis;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
  }
  Object.defineProperty(document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const fileName = String(input).split('/').pop() ?? '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) return new Response(fs.readFileSync(fontPath), { status: 200 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
});

describe('AAB-395 export-audit regressions', () => {
  test('all previews that previously dropped certifications render the certification facts', () => {
    const templateIds: TemplateId[] = [
      'clean-simple',
      'professional-classic',
      'nordic-clean',
      'corporate-navy',
      'contemporary-bold',
    ];
    for (const templateId of templateIds) {
      const Component = templateComponents[templateId];
      expect(Component, templateId).toBeDefined();
      const html = renderToStaticMarkup(<Component data={auditCv(templateId)} locale="en" />);
      expect(html, templateId).toContain(CERTIFICATION);
    }
  });

  test('Contemporary Bold PDF preserves certifications', async () => {
    const blob = await buildContemporaryBoldPdfBlob(auditCv('contemporary-bold'), 'en');
    const text = extractPdfUnicodeText(Buffer.from(await blob.arrayBuffer()));
    expect(text).toContain(CERTIFICATION);
  });

  test('ATS Standard and Elegant Formal keep long centered header runs on the A4 page', async () => {
    const cases = [
      ['ats-standard', buildAtsStandardPdfBlob],
      ['elegant-formal', buildElegantFormalPdfBlob],
    ] as const;
    const a4WidthPt = 210 * (72 / 25.4);

    for (const [templateId, build] of cases) {
      beginPdfI18nPlacementTracking();
      await build(auditCv(templateId), 'en');
      const placements = endPdfI18nPlacementTracking().filter((record) => record.yPt < 120);
      expect(placements.length, templateId).toBeGreaterThan(0);
      expect(Math.min(...placements.map((record) => record.leftPt)), templateId).toBeGreaterThanOrEqual(-0.1);
      expect(Math.max(...placements.map((record) => record.rightPt)), templateId).toBeLessThanOrEqual(a4WidthPt + 0.1);
    }
  });

  test('Elegant Formal wraps stress-width body runs inside the A4 page', async () => {
    const cv = auditCv('elegant-formal');
    const stressRun = 'Designed resilient services, measured production quality, and documented operational decisions. Node.js, GitHub, REST APIs, CI/CD, SQL, AWS.';
    cv.summary = `${stressRun} ${stressRun}`;
    cv.experience[0]!.description = Array.from({ length: 8 }, (_, index) => `- ${stressRun} AUDIT-STRESS-${index + 1}`).join('\n');

    beginPdfI18nPlacementTracking();
    await buildElegantFormalPdfBlob(cv, 'en');
    const placements = endPdfI18nPlacementTracking();
    const a4WidthPt = 210 * (72 / 25.4);
    const rightmost = placements.reduce((best, record) => record.rightPt > best.rightPt ? record : best);
    expect(placements.length).toBeGreaterThan(0);
    expect(Math.min(...placements.map((record) => record.leftPt))).toBeGreaterThanOrEqual(-0.1);
    expect(rightmost.rightPt, JSON.stringify(rightmost)).toBeLessThanOrEqual(a4WidthPt + 0.1);
  });

  test('Contemporary Bold uses column-scoped headings for Skills and Languages', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'contemporary-bold-pdf-renderer.ts'), 'utf8');
    expect(source).toContain('cbDrawSectionHeadingAt(ctx, ctx.labels.skills, colX, colW, startY)');
    expect(source).toContain('cbDrawSectionHeadingAt(ctx, ctx.labels.languages, colX, colW, startY)');
  });

  test('Arabic direct-PDF runs stay inside A4 bounds across every previously affected route', async () => {
    const cv = auditCv('clean-simple');
    cv.personal.fullName = 'ليان الخطيب';
    cv.personal.jobTitle = 'مهندسة منصات أولى';
    cv.personal.address = 'عمّان، الأردن';
    cv.summary = 'مهندسة منصات تبني خدمات موثوقة وتحسن جودة التسليم.';
    cv.canonicalSummary = cv.summary;
    cv.contentLocale = 'ar';
    cv.experience[0]!.position = 'مهندسة منصات أولى';
    cv.experience[0]!.company = 'أنظمة النجم الشمالي';
    cv.experience[0]!.description = '- صممت خدمات مرنة ووثقت القرارات التشغيلية.';
    cv.experience[0]!.canonicalDescription = cv.experience[0]!.description;
    cv.experience[0]!.originalUserDescription = cv.experience[0]!.description;
    cv.education[0]!.degree = 'ماجستير علوم الحاسوب';
    cv.education[0]!.school = 'الجامعة التقنية الوطنية';
    cv.certifications = ['شهادة هندسة الحلول السحابية'];
    cv.languages = [{ name: 'العربية', level: 'اللغة الأم' }];

    const routes = [
      ['clean-simple', buildCleanSimplePdfBlob],
      ['executive-premium', buildExecutivePremiumPdfBlob],
      ['tech-sidebar', buildTechSidebarPdfBlob],
      ['corporate-navy', buildCorporateNavyPdfBlob],
      ['contemporary-bold', buildContemporaryBoldPdfBlob],
      ['rirekisho', buildRirekishoPdfBlob],
    ] as const;
    const a4WidthPt = 210 * (72 / 25.4);

    for (const [templateId, build] of routes) {
      cv.templateId = templateId;
      beginPdfI18nPlacementTracking();
      await build(cv, 'ar');
      const placements = endPdfI18nPlacementTracking();
      expect(placements.length, templateId).toBeGreaterThan(0);
      expect(Math.min(...placements.map((record) => record.leftPt)), templateId).toBeGreaterThanOrEqual(-0.1);
      expect(Math.max(...placements.map((record) => record.rightPt)), templateId).toBeLessThanOrEqual(a4WidthPt + 0.1);
    }
  });

  test('Tech Sidebar advances below language rows before certifications', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'tech-sidebar-pdf-renderer.ts'), 'utf8');
    expect(source).toContain('sy = tsDrawSidebarLanguages(ctx, sy);');
    expect(source).not.toMatch(/\n\s*tsDrawSidebarLanguages\(ctx, sy\);/);
  });

  test('Rirekisho splits localized certification text independently from its Japanese marker', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'rirekisho-pdf-renderer.ts'), 'utf8');
    expect(source).toContain("const lines = wrap(ctx, cert, ctx.contentW - 5, style);");
    expect(source).not.toContain("wrap(ctx, `\\u30fb${rkNormalizePdfText(cert, ctx.locale)}`");
  });
});
