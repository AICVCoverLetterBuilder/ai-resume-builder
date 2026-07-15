/**
 * Shared shrink-safe class names for Cover Letter mobile UI.
 * Keeps long-locale segment labels (e.g. Russian) from widening the page.
 */

export const COVER_LETTER_PAGE_SHELL_CLASS =
  'flex min-h-screen w-full max-w-full min-w-0 flex-col overflow-x-clip';

export const COVER_LETTER_MAIN_CLASS =
  'w-full max-w-full min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8';

export const COVER_LETTER_CONTENT_CLASS = 'mx-auto w-full max-w-4xl min-w-0';

/** Stack title/save on narrow screens; row layout from `sm` upward. */
export const COVER_LETTER_TITLE_ROW_RESPONSIVE_CLASS =
  'mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';

export const COVER_LETTER_TITLE_CLASS =
  'min-w-0 flex-1 text-2xl font-bold break-words leading-tight';

export const COVER_LETTER_SAVE_CLUSTER_CLASS = 'flex shrink-0 items-center gap-3 self-start sm:self-auto';

export const COVER_LETTER_CARD_CLASS =
  'w-full max-w-full min-w-0 rounded-xl border border-border bg-card p-6 space-y-4';

export const COVER_LETTER_PREVIEW_CARD_CLASS =
  'w-full max-w-full min-w-0 rounded-xl border border-border bg-card p-6';

export const COVER_LETTER_FORM_GRID_CLASS = 'grid w-full min-w-0 gap-8 lg:grid-cols-2';

export const COVER_LETTER_SEGMENTED_ROW_CLASS =
  'grid w-full min-w-0 grid-cols-3 gap-1.5 sm:gap-2';

export const COVER_LETTER_SEGMENTED_BTN_BASE_CLASS =
  'min-w-0 w-full rounded-lg border px-1.5 py-1.5 text-center text-xs font-medium leading-tight whitespace-normal break-words transition-all sm:px-2';

export const COVER_LETTER_TONE_BTN_BASE_CLASS =
  'min-w-0 w-full rounded-lg border px-1.5 py-2 text-center text-xs font-medium leading-tight whitespace-normal break-words transition-all sm:px-2 sm:text-sm';

export const COVER_LETTER_SEGMENTED_BTN_MIN_HEIGHT_CLASS = 'min-h-[2.75rem]';
export const COVER_LETTER_TONE_BTN_MIN_HEIGHT_CLASS = 'min-h-[3rem]';
