// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Browser, Page } from 'playwright';
import {
  buildCoverLetterMobileLayoutHtml,
  COVER_LETTER_MOBILE_VIEWPORTS,
  coverLetterLayoutLabelsForLocale,
  measureCoverLetterLayoutPage,
} from '../cover-letter-mobile-layout-fixture';
import type { Locale } from '../i18n/translations';

const LONG_LABEL_LOCALES: Locale[] = ['ru', 'de', 'pt-BR', 'fr', 'hr'];

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

describe('Cover Letter mobile layout overflow (Chromium)', () => {
  let browser: Browser | null = null;
  let playwrightAvailable = false;

  beforeAll(async () => {
    const pw = await loadPlaywright();
    if (!pw) return;
    playwrightAvailable = true;
    browser = await pw.chromium.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  async function measureLocale(locale: Locale, width: number): Promise<{
    page: Awaited<ReturnType<typeof measureCoverLetterLayoutPage>>;
    labels: ReturnType<typeof coverLetterLayoutLabelsForLocale>;
  }> {
    if (!browser) throw new Error('Playwright browser unavailable');
    const page: Page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      const labels = coverLetterLayoutLabelsForLocale(locale);
      await page.setContent(buildCoverLetterMobileLayoutHtml(locale, labels), {
        waitUntil: 'networkidle',
      });
      const measured = await measureCoverLetterLayoutPage(page);
      return { page: measured, labels };
    } finally {
      await page.close();
    }
  }

  test('skips meaningfully if Playwright is not installed', async () => {
    if (!playwrightAvailable) {
      console.warn('[cover-letter-mobile-ru-overflow] Playwright missing — layout browser tests skipped');
    }
    expect(true).toBe(true);
  });

  test('Russian has no horizontal overflow at mobile viewports', async () => {
    if (!browser) return;
    const labels = coverLetterLayoutLabelsForLocale('ru');
    expect(labels.genderMale).toBe('Мужской');
    expect(labels.genderFemale).toBe('Женский');
    expect(labels.genderPreferNot).toBe('Не указывать');
    expect(labels.tones).toEqual(['Формальный', 'Уверенный', 'Дружелюбный']);

    for (const width of COVER_LETTER_MOBILE_VIEWPORTS) {
      const { page: m } = await measureLocale('ru', width);
      expect(m.docScrollWidth, `ru@${width}`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.bodyScrollWidth, `ru@${width}`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.pageOverflow, `ru@${width}`).toBe(false);
      expect(m.overflowing, `ru@${width}`).toEqual([]);

      for (const id of [
        'header',
        'title-row',
        'info-card',
        'identity-card',
        'gender-row',
        'job-company',
        'tone-row',
        'generate-card',
        'privacy',
        'preview-card',
      ]) {
        const section = m.sections[id];
        expect(section, id).toBeTruthy();
        expect(section.left, id).toBeGreaterThanOrEqual(-0.5);
        expect(section.right, id).toBeLessThanOrEqual(m.clientWidth + 0.5);
      }

      const genderBtns = Object.values(m.sections).filter((s) => s.id.startsWith('gender-row-btn-'));
      const toneBtns = Object.values(m.sections).filter((s) => s.id.startsWith('tone-row-btn-'));
      expect(genderBtns).toHaveLength(3);
      expect(toneBtns).toHaveLength(3);
      for (const btn of [...genderBtns, ...toneBtns]) {
        expect(btn.exceedsViewport).toBe(false);
        expect(btn.textAlign).toBe('center');
        expect(btn.width).toBeGreaterThan(20);
      }
    }
  }, 120_000);

  test('EN → RU → EN → RU keeps scrollWidth within viewport', async () => {
    if (!browser) return;
    const page = await browser.newPage({ viewport: { width: 360, height: 900 } });
    try {
      for (const locale of ['en', 'ru', 'en', 'ru'] as const) {
        await page.setContent(buildCoverLetterMobileLayoutHtml(locale), {
          waitUntil: 'networkidle',
        });
        await page.evaluate(() => {
          window.scrollTo({ left: 0 });
          document.documentElement.scrollLeft = 0;
          document.body.scrollLeft = 0;
        });
        const m = await measureCoverLetterLayoutPage(page);
        expect(m.pageOverflow, locale).toBe(false);
        expect(m.docScrollWidth).toBeLessThanOrEqual(m.clientWidth);
      }
    } finally {
      await page.close();
    }
  }, 120_000);

  test('long-label locales de/pt-BR/fr/hr stay within mobile viewports', async () => {
    if (!browser) return;
    for (const locale of LONG_LABEL_LOCALES.filter((l) => l !== 'ru')) {
      for (const width of [320, 375, 412] as const) {
        const { page: m } = await measureLocale(locale, width);
        expect(m.pageOverflow, `${locale}@${width}`).toBe(false);
        expect(m.docScrollWidth).toBeLessThanOrEqual(m.clientWidth);
        expect(m.overflowing).toEqual([]);
      }
    }
  }, 180_000);
});
