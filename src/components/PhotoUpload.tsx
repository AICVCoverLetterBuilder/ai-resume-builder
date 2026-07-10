'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Crop, ZoomIn, ZoomOut, RotateCcw, Sparkles, Camera, Eye, EyeOff } from 'lucide-react';
import type { Region } from '@/lib/types';
import { useI18n } from '@/lib/i18n/context';
import { PremiumAIButton, ProBadge } from '@/components/PremiumAIButton';
import {
  ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
  ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
  getElegantFormalCoverCropMetrics,
} from '@/lib/elegant-formal-photo';

interface PhotoUploadProps {
  photo?: string;
  photoEnabled?: boolean;
  region: Region;
  isPro?: boolean;
  photoShape?: 'circle' | 'rectangle';
  /** Opens the existing Upgrade to Pro modal for free users. */
  onUpgradeRequest?: () => void;
  /** `originalPhoto` is the raw uploaded file data URL, never circular/rect cropped.
   *  `rectPhoto` is always the 300×400 JPEG cropped with the same zoom/offset as `photo`. */
  onChange: (photo: string | undefined, enabled: boolean, originalPhoto?: string, rectPhoto?: string) => void;
}

// Region-based default visibility
function getDefaultPhotoVisibility(region: Region): boolean {
  return region !== 'US';
}

function PhotoPreview({ photo, alt }: { photo: string; alt: string }) {
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    const isPortrait = el.naturalHeight > el.naturalWidth;
    el.style.objectPosition = isPortrait ? '50% 20%' : '50% 50%';
  };

  return (
    <img
      ref={imgRef}
      src={photo}
      alt={alt}
      onLoad={handleLoad}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'top center', // fallback until onLoad fires
        display: 'block',
      }}
    />
  );
}

export function PhotoUpload({ photo, photoEnabled, region, isPro = false, photoShape = 'circle', onUpgradeRequest, onChange }: PhotoUploadProps) {
  const { t } = useI18n();
  // photoEnabled: undefined = use region default, true/false = user override
  const isEnabled = photoEnabled !== undefined ? photoEnabled : getDefaultPhotoVisibility(region);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const hasPhoto = Boolean(photo);
  const aiLocked = !isPro || !hasPhoto;

  const [showCropper, setShowCropper] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  // originalRaw: the data URL from the file input — never overwritten by crop outputs.
  // Re-crop always re-opens the cropper from this original, not from the already-cropped photo.
  const [originalRaw, setOriginalRaw] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropSize = 240; // px — used as width; height = cropSize * 4/3 for rectangle
  const cropW = cropSize;
  const cropH = photoShape === 'rectangle' ? Math.round(cropSize * 4 / 3) : cropSize;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert(t.cv.photo.errorFormat);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit. Please choose a smaller image.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setRawImage(src);
      setOriginalRaw(src); // store original — never overwritten by crop output
      // zoom and offset will be set to fit-contain values in the useEffect once img loads
      setOffset({ x: 0, y: 0 });
      setAiEnhanced(false);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const drawCropPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = imgRef.current;
    canvas.width = cropW;
    canvas.height = cropH;
    ctx.clearRect(0, 0, cropW, cropH);
    ctx.save();
    if (photoShape === 'circle') {
      ctx.beginPath();
      ctx.arc(cropW / 2, cropH / 2, cropW / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      // White fill so no transparent/black artifact corners
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cropW, cropH);
    }
    const scaledW = img.naturalWidth * zoom;
    const scaledH = img.naturalHeight * zoom;
    const dx = (cropW - scaledW) / 2 + offset.x;
    const dy = (cropH - scaledH) / 2 + offset.y;
    if (photoShape === 'rectangle') {
      const metrics = getElegantFormalCoverCropMetrics(img.naturalWidth, img.naturalHeight, cropW, cropH);
      ctx.drawImage(img, metrics.offsetX, metrics.offsetY, img.naturalWidth * metrics.scale, img.naturalHeight * metrics.scale);
    } else {
      ctx.drawImage(img, dx, dy, scaledW, scaledH);
    }
    ctx.restore();
  }, [zoom, offset, photoShape, cropW, cropH]);

  useEffect(() => {
    if (!showCropper || !rawImage) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Calculate "contain" zoom: scale image so it fits fully inside the crop area.
      // Use the smaller ratio so the entire image is visible.
      const fitZoom = Math.min(cropW / img.naturalWidth, cropH / img.naturalHeight);
      setZoom(fitZoom);
      setOffset({ x: 0, y: 0 });
      // drawCropPreview fires from the zoom/offset useEffect below
    };
    img.src = rawImage;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawImage, showCropper]);

  useEffect(() => {
    if (showCropper) drawCropPreview();
  }, [zoom, offset, showCropper, drawCropPreview]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragging(true);
    setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const touch = e.touches[0];
    setOffset({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
  };

  /**
   * Render the current zoom/offset selection into an output canvas of the given shape.
   * The same user-positioned framing is preserved regardless of output shape — the
   * center point the user chose maps to the center of the output canvas.
   *
   *  outShape='circle'    → 300×300 PNG with circular clip
   *  outShape='rectangle' → 300×400 JPEG with white fill (no circular clip, no transparent corners)
   */
  const renderCrop = useCallback((outShape: 'circle' | 'rectangle'): string => {
    const img = imgRef.current;
    if (!img) return '';
    const outW = outShape === 'rectangle' ? ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH : 300;
    const outH = outShape === 'rectangle' ? ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT : 300;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    if (outShape === 'circle') {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
    }

    // Use a SINGLE uniform scale factor based on width only.
    // This preserves the exact zoom and horizontal/vertical framing the user chose in the
    // preview canvas. For the rectangle output (outH > outW), the canvas is simply taller —
    // the image renders at the same scale and center, revealing more content above/below.
    // Using separate scaleFactorX / scaleFactorY would non-uniformly stretch the image and
    // shift the face position, which is the bug this fixes.
    const uniformScale = outW / cropW; // e.g. 300/240 = 1.25 — same for both shapes
    const scaledW = img.naturalWidth  * zoom * uniformScale;
    const scaledH = img.naturalHeight * zoom * uniformScale;
    const dx = (outW - scaledW) / 2 + offset.x * uniformScale;
    // For rectangle output, shift the image upward so the face appears visually centered
    // rather than sitting at the bottom of the taller canvas. The +100px of extra height
    // (400 vs 300) naturally pushes the face down; -40px counteracts that bias.
    // Configurable: RECT_Y_SHIFT applies only when outShape === 'rectangle'.
    const RECT_Y_SHIFT = -40; // px — shift up; tune here if needed
    const dy = (outH - scaledH) / 2 + offset.y * uniformScale + (outShape === 'rectangle' ? RECT_Y_SHIFT : 0);
    ctx.drawImage(img, dx, dy, scaledW, scaledH);

    return outShape === 'circle'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92);
  }, [zoom, offset, cropW]);

  const getCroppedImage = useCallback((): string => renderCrop(photoShape), [renderCrop, photoShape]);

  const handleApplyCrop = () => {
    const cropped = getCroppedImage(); // circle PNG or rect JPEG depending on photoShape
    // Always generate the rect version too, using the exact same zoom/offset the user chose.
    // This is passed to page.tsx so rect templates get correct face positioning.
    const rectCrop = renderCrop('rectangle');
    onChange(cropped, isEnabled, originalRaw ?? undefined, rectCrop);
    setShowCropper(false);
    setRawImage(null);
  };

  const handleRemovePhoto = () => {
    onChange(undefined, isEnabled, undefined);
    setOriginalRaw(null);
    setAiEnhanced(false);
  };

  const handleToggleEnabled = (enabled: boolean) => {
    onChange(photo, enabled);
  };

  const handleAiEnhance = async () => {
    if (!photo) return;
    setAiEnhancing(true);
    // Simulate AI processing (in real app, this would call an AI API)
    await new Promise(r => setTimeout(r, 2000));
    // Apply a CSS filter effect via canvas to simulate enhancement
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (photoShape === 'circle') {
        // Re-apply circular clip so the transparent corners from the source PNG are preserved
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
        ctx.clip();
      } else {
        // White fill to prevent black corners in JPEG output
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.filter = 'contrast(1.08) brightness(1.06) saturate(0.95)';
      ctx.drawImage(img, 0, 0);
      const enhanced = photoShape === 'circle'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.92);
      onChange(enhanced, isEnabled);
      setAiEnhancing(false);
      setAiEnhanced(true);
    };
    img.src = photo;
  };

  const regionLabel = region === 'US'
    ? t.cv.photo.usRegion
    : t.cv.photo.otherRegion;

  const handleAiCardClick = () => {
    if (!hasPhoto) return;
    if (!isPro) {
      onUpgradeRequest?.();
      return;
    }
    void handleAiEnhance();
  };

  const aiSubtitle = !hasPhoto
    ? 'Upload a photo to enhance'
    : isPro
      ? (aiEnhancing ? undefined : 'Remove bg & sharpen')
      : t.cv.photo.upgrade;

  return (
    <div className="box-border w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold break-words">
            {t.cv.photo.title}{' '}
            <span className="font-normal text-muted-foreground">({t.cv.photo.optional})</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground break-words">{regionLabel}</p>
        </div>
        {/* Toggle show/hide */}
        <button
          type="button"
          onClick={() => handleToggleEnabled(!isEnabled)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
            isEnabled
              ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
              : 'border-border bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          <span className="whitespace-nowrap">{isEnabled ? t.cv.photo.shown : t.cv.photo.hidden}</span>
        </button>
      </div>

      {!isEnabled && (
        <p className="mb-3 text-xs italic text-muted-foreground break-words">
          {t.cv.photo.hiddenDesc}
        </p>
      )}

      <div className={`box-border w-full max-w-full min-w-0 space-y-4 ${!isEnabled ? 'opacity-60' : ''}`}>
        {/* Photo preview + action buttons — stacks cleanly on narrow screens */}
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="mx-auto shrink-0 sm:mx-0">
            {photo ? (
              <div
                className="relative overflow-hidden border-2 border-primary/20 shadow-md"
                style={{
                  width: photoShape === 'rectangle' ? 60 : 80,
                  height: photoShape === 'rectangle' ? 80 : 80,
                  borderRadius: photoShape === 'circle' ? '50%' : '4px',
                }}
              >
                <PhotoPreview photo={photo} alt={t.cv.photo.title} />
                <button
                  onClick={handleRemovePhoto}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100"
                  style={{ borderRadius: photoShape === 'circle' ? '50%' : '4px' }}
                  title={t.cv.photo.remove}
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center justify-center border-2 border-dashed border-border bg-muted/30"
                style={{
                  width: photoShape === 'rectangle' ? 60 : 80,
                  height: photoShape === 'rectangle' ? 80 : 80,
                  borderRadius: photoShape === 'circle' ? '50%' : '4px',
                }}
              >
                <Camera className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 w-full flex-1 space-y-2">
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent sm:w-auto sm:justify-start sm:py-1.5"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{photo ? t.cv.photo.change : t.cv.photo.upload}</span>
              </button>
              {photo && (
                <button
                  type="button"
                  onClick={() => { setRawImage(originalRaw ?? photo ?? null); setShowCropper(true); setOffset({ x: 0, y: 0 }); }}
                  className="inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent sm:w-auto sm:justify-start sm:py-1.5"
                >
                  <Crop className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.cv.photo.recrop}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground break-words">{t.cv.photo.hint}</p>
          </div>
        </div>

        {/* AI Enhancement — always rendered inside the Profile Photo card (full width) */}
        <div
          className={`box-border w-full max-w-full min-w-0 rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-3 ${aiLocked ? 'opacity-90' : ''}`}
          style={{ backgroundImage: 'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 60%)' }}
        >
          <PremiumAIButton
            type="button"
            onClick={handleAiCardClick}
            disabled={aiEnhancing || !hasPhoto}
            icon={Sparkles}
            label={aiEnhancing ? t.cv.photo.aiEnhancing : t.cv.photo.aiEnhance}
            subtitle={aiSubtitle}
            badge={
              aiEnhanced && isPro && hasPhoto
                ? <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-400">{t.cv.photo.applied}</span>
                : <ProBadge />
            }
            showArrow
            className={`!px-3 !py-2.5 !rounded-xl max-w-full min-w-0 ${!isPro && hasPhoto ? '!opacity-80' : ''}`}
          />
          {isPro && hasPhoto && (
            <ul className="mt-2 grid w-full min-w-0 grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
              {t.cv.photo.features.map(f => (
                <li key={f} className="flex min-w-0 items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  <span className="min-w-0 break-words">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Crop Modal */}
      {showCropper && rawImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Crop className="h-4 w-4 text-primary" />
                {t.cv.photo.cropTitle}
              </h3>
              <button onClick={() => { setShowCropper(false); setRawImage(null); }} className="rounded-md p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-3 text-center">{t.cv.photo.cropHint}</p>

              {/* Canvas crop area */}
              <div className="flex justify-center mb-4">
                <div
                  className="relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
                  style={{
                    width: cropW,
                    height: cropH,
                    borderRadius: photoShape === 'circle' ? '50%' : '4px',
                    border: '2px solid hsl(var(--primary))',
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                >
                  <canvas
                    ref={canvasRef}
                    width={cropW}
                    height={cropH}
                    style={{ display: 'block', borderRadius: photoShape === 'circle' ? '50%' : '4px' }}
                  />
                </div>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(0.05, z - 0.05))}
                  className="rounded-md border border-border p-1.5 hover:bg-accent"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <input
                  type="range" min="0.05" max="3" step="0.01"
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 accent-primary"
                />
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.min(3, z + 0.05))}
                  className="rounded-md border border-border p-1.5 hover:bg-accent"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (imgRef.current) {
                      const fitZoom = Math.min(cropW / imgRef.current.naturalWidth, cropH / imgRef.current.naturalHeight);
                      setZoom(fitZoom);
                    }
                    setOffset({ x: 0, y: 0 });
                  }}
                  className="rounded-md border border-border p-1.5 hover:bg-accent"
                  title={t.cv.photo.recrop}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCropper(false); setRawImage(null); }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t.cv.photo.apply}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
