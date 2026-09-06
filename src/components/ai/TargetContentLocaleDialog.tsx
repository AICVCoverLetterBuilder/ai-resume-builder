'use client';

import { useMemo } from 'react';
import {
  CONTENT_LOCALIZE_M6_TARGET_LOCALES,
  type ContentLocalizeM6TargetLocale,
} from '@/lib/ai-core-v3/content-localize-m6';
import { useI18n } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/translations';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface TargetContentLocaleDialogProps {
  readonly open: boolean;
  readonly sourceLocale: Locale | null;
  readonly targetLocale: ContentLocalizeM6TargetLocale | null;
  readonly busy?: boolean;
  readonly onTargetLocaleChange: (targetLocale: ContentLocalizeM6TargetLocale | null) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Presentation-only explicit target selector shared by future M6 content
 * surfaces. It owns no CV, request, persistence, usage, or provider state.
 */
export function TargetContentLocaleDialog({
  open,
  sourceLocale,
  targetLocale,
  busy = false,
  onTargetLocaleChange,
  onConfirm,
  onCancel,
}: TargetContentLocaleDialogProps) {
  const { t, languages: localeMetadata = [] } = useI18n();
  const options = useMemo(() => CONTENT_LOCALIZE_M6_TARGET_LOCALES.map((code) => {
    const metadata = localeMetadata.find((language) => language.code === code) || null;
    return { code, metadata };
  }), [localeMetadata]);
  const metadataComplete = options.every(({ metadata }) => metadata !== null);
  const source = sourceLocale ? localeMetadata.find((language) => language.code === sourceLocale) || null : null;
  const canConfirm = metadataComplete
    && Boolean(sourceLocale)
    && Boolean(targetLocale)
    && targetLocale !== sourceLocale
    && !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onCancel();
      }}
    >
      <DialogContent showCloseButton={!busy} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t.cv.translate}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium" htmlFor="content-localize-source-language">
            <span>{t.common.sourceLanguage}</span>
            <input
              id="content-localize-source-language"
              data-content-localize-source-language
              readOnly
              value={source ? `${source.flag} ${source.nativeName}` : ''}
              className="h-10 w-full cursor-not-allowed rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium" htmlFor="content-localize-target-language">
            <span>{t.common.targetLanguage}</span>
            <select
              id="content-localize-target-language"
              data-content-localize-target-language
              value={targetLocale || ''}
              disabled={!metadataComplete || busy || !sourceLocale}
              onChange={(event) => {
                const value = event.target.value;
                const selected = CONTENT_LOCALIZE_M6_TARGET_LOCALES.find((code) => code === value) || null;
                onTargetLocaleChange(selected);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{t.common.targetLanguage}</option>
              {options.map(({ code, metadata }) => (
                <option key={code} value={code} disabled={code === sourceLocale || metadata === null}>
                  {metadata ? `${metadata.flag} ${metadata.nativeName}` : code}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            data-content-localize-confirm
            onClick={onConfirm}
            disabled={!canConfirm}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t.common.loading : t.cv.translate}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
