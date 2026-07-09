'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TemplatePreview } from '@/components/TemplatePreview';
import { usePinchPanZoom } from '@/hooks/usePinchPanZoom';
import type { TemplateId } from '@/lib/types';

interface TemplatePreviewFullscreenModalProps {
  open: boolean;
  templateId: TemplateId | null;
  templateName: string;
  selectLabel: string;
  previewLabel: string;
  pinchHint?: string;
  onClose: () => void;
  onSelect: (templateId: TemplateId) => void;
}

export function TemplatePreviewFullscreenModal({
  open,
  templateId,
  templateName,
  selectLabel,
  previewLabel,
  pinchHint = 'Pinch or scroll to zoom',
  onClose,
  onSelect,
}: TemplatePreviewFullscreenModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const {
    transform,
    reset,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
    isZoomed,
  } = usePinchPanZoom(open && !!templateId);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) reset();
  }, [open, templateId, reset]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return;
    const blockScroll = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => el.removeEventListener('touchmove', blockScroll);
  }, [open]);

  const handleSelect = () => {
    if (!templateId) return;
    onSelect(templateId);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && templateId && (
        <>
          <motion.button
            type="button"
            key="backdrop"
            aria-label={previewLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={templateName}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-[71] flex flex-col bg-background sm:inset-4 sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:mx-auto sm:max-w-4xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {previewLabel}
                </p>
                <h2 className="truncate text-base font-bold text-foreground sm:text-lg">{templateName}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={viewportRef}
              className="relative flex-1 min-h-0 overflow-hidden bg-muted/20 touch-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onWheel={onWheel}
            >
              <div
                className="absolute inset-3 sm:inset-6 flex items-start justify-center"
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: 'top center',
                  transition: isZoomed ? 'none' : 'transform 0.15s ease-out',
                }}
              >
                <div className="w-full max-w-[min(100%,42rem)] aspect-[210/297] rounded-lg border border-border bg-white shadow-xl overflow-hidden">
                  <TemplatePreview templateId={templateId} lazy={false} maxScale={0.95} />
                </div>
              </div>
              <div className="pointer-events-none absolute bottom-3 inset-x-0 flex justify-center">
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                  {pinchHint}
                </span>
              </div>
            </div>

            <div className="border-t border-border p-4 shrink-0">
              <button
                type="button"
                onClick={handleSelect}
                className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {selectLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
