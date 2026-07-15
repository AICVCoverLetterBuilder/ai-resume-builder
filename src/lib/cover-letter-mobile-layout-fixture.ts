/**
 * Standalone HTML fixture mirroring Cover Letter mobile controls + layout classes.
 * Used by Chromium layout tests (jsdom cannot measure scrollWidth meaningfully).
 */
import {
  COVER_LETTER_CARD_CLASS,
  COVER_LETTER_CONTENT_CLASS,
  COVER_LETTER_FORM_GRID_CLASS,
  COVER_LETTER_MAIN_CLASS,
  COVER_LETTER_PAGE_SHELL_CLASS,
  COVER_LETTER_PREVIEW_CARD_CLASS,
  COVER_LETTER_SAVE_CLUSTER_CLASS,
  COVER_LETTER_SEGMENTED_BTN_BASE_CLASS,
  COVER_LETTER_SEGMENTED_BTN_MIN_HEIGHT_CLASS,
  COVER_LETTER_SEGMENTED_ROW_CLASS,
  COVER_LETTER_TITLE_CLASS,
  COVER_LETTER_TITLE_ROW_RESPONSIVE_CLASS,
  COVER_LETTER_TONE_BTN_BASE_CLASS,
  COVER_LETTER_TONE_BTN_MIN_HEIGHT_CLASS,
} from './cover-letter-mobile-layout';
import { translations, type Locale } from './i18n/translations';

export type CoverLetterLayoutFixtureLabels = {
  title: string;
  save: string;
  identity: string;
  genderMale: string;
  genderFemale: string;
  genderPreferNot: string;
  tones: [string, string, string];
  generate: string;
  generateSubtitle: string;
  privacy: string;
  preview: string;
};

export function coverLetterLayoutLabelsForLocale(locale: Locale): CoverLetterLayoutFixtureLabels {
  const t = translations[locale];
  return {
    title: t.coverLetter.title,
    save: t.common.save,
    identity: t.coverLetter.identitySection,
    genderMale: t.coverLetter.genderMale,
    genderFemale: t.coverLetter.genderFemale,
    genderPreferNot: t.coverLetter.genderPreferNot,
    tones: [
      t.coverLetter.tones.formal,
      t.coverLetter.tones.confident,
      t.coverLetter.tones.friendly,
    ],
    generate: t.coverLetter.generate,
    generateSubtitle: t.coverLetter.generateSubtitle,
    privacy: t.about.aiDisclosure.items[0],
    preview: t.coverLetter.preview,
  };
}

export function buildCoverLetterMobileLayoutHtml(
  locale: Locale,
  labels: CoverLetterLayoutFixtureLabels = coverLetterLayoutLabelsForLocale(locale),
): string {
  const genderBtns = [labels.genderMale, labels.genderFemale, labels.genderPreferNot]
    .map(
      (label) =>
        `<button type="button" class="${COVER_LETTER_SEGMENTED_BTN_BASE_CLASS} ${COVER_LETTER_SEGMENTED_BTN_MIN_HEIGHT_CLASS} border">${label}</button>`,
    )
    .join('');
  const toneBtns = labels.tones
    .map(
      (label) =>
        `<button type="button" class="${COVER_LETTER_TONE_BTN_BASE_CLASS} ${COVER_LETTER_TONE_BTN_MIN_HEIGHT_CLASS} border">${label}</button>`,
    )
    .join('');

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif}</style>
</head>
<body>
<div data-probe="page-root" class="${COVER_LETTER_PAGE_SHELL_CLASS}">
  <header data-probe="header" class="sticky top-0 z-50 w-full border-b bg-white">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
      <div class="font-bold text-xl">CV Pro AI</div>
      <button type="button" class="rounded-md p-2" aria-label="menu">☰</button>
    </div>
  </header>
  <main class="${COVER_LETTER_MAIN_CLASS}">
    <div class="${COVER_LETTER_CONTENT_CLASS}">
      <div data-probe="title-row" class="${COVER_LETTER_TITLE_ROW_RESPONSIVE_CLASS}">
        <h1 class="${COVER_LETTER_TITLE_CLASS}">${labels.title}</h1>
        <div class="${COVER_LETTER_SAVE_CLUSTER_CLASS}">
          <button type="button" class="inline-flex shrink-0 items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">${labels.save}</button>
        </div>
      </div>
      <div class="${COVER_LETTER_FORM_GRID_CLASS}">
        <div data-probe="info-card" class="${COVER_LETTER_CARD_CLASS}">
          <div data-probe="identity-card" class="min-w-0 w-full max-w-full rounded-lg border bg-gray-50 p-3 space-y-3">
            <div class="text-xs font-semibold uppercase">${labels.identity}</div>
            <div class="grid min-w-0 grid-cols-2 gap-3">
              <input class="h-10 w-full min-w-0 rounded-lg border px-3 text-sm" />
              <input class="h-10 w-full min-w-0 rounded-lg border px-3 text-sm" />
            </div>
            <div data-probe="gender-row" class="${COVER_LETTER_SEGMENTED_ROW_CLASS}">${genderBtns}</div>
          </div>
          <div data-probe="job-company" class="min-w-0 space-y-3">
            <input class="h-10 w-full min-w-0 rounded-lg border px-3 text-sm" />
            <input class="h-10 w-full min-w-0 rounded-lg border px-3 text-sm" />
          </div>
          <div data-probe="tone-row" class="${COVER_LETTER_SEGMENTED_ROW_CLASS}">${toneBtns}</div>
          <div data-probe="generate-card" class="relative min-w-0 w-full max-w-full">
            <button type="button" class="flex w-full max-w-full min-w-0 items-start gap-3 overflow-hidden rounded-[17px] border bg-[#080b12] px-4 py-3 text-left text-white">
              <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">✦</span>
              <span class="relative flex min-w-0 flex-1 flex-col gap-[3px]">
                <span class="min-w-0 text-[15px] font-semibold leading-[1.25] break-words">${labels.generate}</span>
                <span class="min-w-0 text-[12px] leading-[1.4] opacity-60 line-clamp-2 break-words">${labels.generateSubtitle}</span>
              </span>
            </button>
          </div>
          <div data-probe="privacy" class="min-w-0 w-full max-w-full rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p class="text-[10px] leading-relaxed break-words">${labels.privacy}</p>
          </div>
        </div>
        <div data-probe="preview-card" class="${COVER_LETTER_PREVIEW_CARD_CLASS}">
          <h3 class="mb-4 min-w-0 font-semibold break-words">${labels.preview}</h3>
          <div class="min-h-[200px] rounded-lg border p-6 text-sm">Preview body</div>
        </div>
      </div>
    </div>
  </main>
</div>
</body>
</html>`;
}

export const COVER_LETTER_MOBILE_VIEWPORTS = [320, 360, 375, 390, 412] as const;

export type CoverLetterLayoutMeasure = {
  clientWidth: number;
  docScrollWidth: number;
  bodyScrollWidth: number;
  pageOverflow: boolean;
  sections: Record<
    string,
    { id: string; left: number; right: number; width: number; exceedsViewport: boolean; textAlign?: string }
  >;
  overflowing: Array<{ id: string; left: number; right: number }>;
};

export async function measureCoverLetterLayoutPage(page: {
  evaluate: (fn: () => CoverLetterLayoutMeasure) => Promise<CoverLetterLayoutMeasure>;
}): Promise<CoverLetterLayoutMeasure> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const probes = [...document.querySelectorAll('[data-probe]')];
    const overflowing: Array<{ id: string; left: number; right: number }> = [];
    const sections: CoverLetterLayoutMeasure['sections'] = {};
    for (const el of probes) {
      const r = el.getBoundingClientRect();
      const id = el.getAttribute('data-probe') || 'unknown';
      const entry = {
        id,
        left: r.left,
        right: r.right,
        width: r.width,
        exceedsViewport: r.right > vw + 0.5 || r.left < -0.5,
      };
      sections[id] = entry;
      if (entry.exceedsViewport) overflowing.push(entry);
    }
    for (const rowId of ['gender-row', 'tone-row']) {
      const row = document.querySelector(`[data-probe="${rowId}"]`);
      if (!row) continue;
      [...row.children].forEach((btn, i) => {
        const r = (btn as HTMLElement).getBoundingClientRect();
        const id = `${rowId}-btn-${i}:${btn.textContent}`;
        const entry = {
          id,
          left: r.left,
          right: r.right,
          width: r.width,
          exceedsViewport: r.right > vw + 0.5 || r.left < -0.5,
          textAlign: getComputedStyle(btn as HTMLElement).textAlign,
        };
        sections[id] = entry;
        if (entry.exceedsViewport) overflowing.push(entry);
      });
    }
    return {
      clientWidth: vw,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      pageOverflow: document.documentElement.scrollWidth > vw + 1,
      sections,
      overflowing,
    };
  });
}
