/**
 * Shared PDF profile-photo preparation and drawing helpers.
 * Canvas pre-masking is used so jsPDF receives transparent PNGs for circular frames.
 */

type PdfPhotoWriter = InstanceType<typeof import('jspdf').jsPDF>;

export type PdfPhotoShape = 'circle' | 'rounded-square';

export type PreparePdfProfilePhotoOptions = {
  sizePx?: number;
  shape?: PdfPhotoShape;
  cornerRadiusPx?: number;
};

export type PdfPhotoBorderSpec = {
  color: [number, number, number];
  lineWidth: number;
  radiusDelta: number;
};

export type DrawCircularPdfPhotoOptions = {
  outerFill?: [number, number, number];
  outerRadiusDelta?: number;
  borders?: PdfPhotoBorderSpec[];
  borderColor?: [number, number, number];
  borderWidth?: number;
  borderRadiusDelta?: number;
};

export type CircularPhotoInspection = {
  isPng: boolean;
  width: number;
  height: number;
  hasTransparentCorners: boolean;
  hasOpaqueCenter: boolean;
};

const DEFAULT_PDF_PHOTO_SIZE_PX = 320;
const photoCache = new Map<string, string>();

function cacheKey(dataUrl: string, options: PreparePdfProfilePhotoOptions): string {
  const sizePx = options.sizePx ?? DEFAULT_PDF_PHOTO_SIZE_PX;
  const shape = options.shape ?? 'circle';
  const cornerRadiusPx = options.cornerRadiusPx ?? 0;
  return `${shape}:${sizePx}:${cornerRadiusPx}:${dataUrl.length}:${dataUrl.slice(0, 96)}`;
}

export function clearPdfPhotoCache(): void {
  photoCache.clear();
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('PDF_PHOTO_LOAD_FAILED'));
    img.src = dataUrl;
  });
}

function coverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const scaledW = sourceWidth * scale;
  const scaledH = sourceHeight * scale;
  return {
    sx: 0,
    sy: 0,
    sw: sourceWidth,
    sh: sourceHeight,
    dx: (targetWidth - scaledW) / 2,
    dy: (targetHeight - scaledH) / 2,
    dw: scaledW,
    dh: scaledH,
  };
}

export function createCircularPhotoDataUrl(photoDataUrl: string, sizePx: number): Promise<string> {
  return loadImage(photoDataUrl).then((img) => {
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error('PDF_PHOTO_DIMENSIONS_MISSING');
    }

    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF_PHOTO_CANVAS_MISSING');

    ctx.clearRect(0, 0, sizePx, sizePx);
    const crop = coverCropRect(sourceWidth, sourceHeight, sizePx, sizePx);

    ctx.save();
    ctx.beginPath();
    ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
    ctx.restore();

    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    return canvas.toDataURL('image/png');
  });
}

export function createRoundedSquarePhotoDataUrl(
  photoDataUrl: string,
  sizePx: number,
  radiusPx: number,
): Promise<string> {
  return loadImage(photoDataUrl).then((img) => {
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error('PDF_PHOTO_DIMENSIONS_MISSING');
    }

    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF_PHOTO_CANVAS_MISSING');

    const crop = coverCropRect(sourceWidth, sourceHeight, sizePx, sizePx);
    const r = Math.max(0, Math.min(radiusPx, sizePx / 2));

    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(sizePx - r, 0);
    ctx.quadraticCurveTo(sizePx, 0, sizePx, r);
    ctx.lineTo(sizePx, sizePx - r);
    ctx.quadraticCurveTo(sizePx, sizePx, sizePx - r, sizePx);
    ctx.lineTo(r, sizePx);
    ctx.quadraticCurveTo(0, sizePx, 0, sizePx - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
    ctx.restore();

    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(sizePx - r, 0);
    ctx.quadraticCurveTo(sizePx, 0, sizePx, r);
    ctx.lineTo(sizePx, sizePx - r);
    ctx.quadraticCurveTo(sizePx, sizePx, sizePx - r, sizePx);
    ctx.lineTo(r, sizePx);
    ctx.quadraticCurveTo(0, sizePx, 0, sizePx - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    return canvas.toDataURL('image/png');
  });
}

export function preparePdfProfilePhotoDataUrl(
  photoDataUrl: string,
  options: PreparePdfProfilePhotoOptions = {},
): Promise<string> {
  const key = cacheKey(photoDataUrl, options);
  const cached = photoCache.get(key);
  if (cached) return Promise.resolve(cached);

  const sizePx = options.sizePx ?? DEFAULT_PDF_PHOTO_SIZE_PX;
  const shape = options.shape ?? 'circle';
  const promise = shape === 'rounded-square'
    ? createRoundedSquarePhotoDataUrl(
      photoDataUrl,
      sizePx,
      options.cornerRadiusPx ?? Math.round(sizePx * 0.12),
    )
    : createCircularPhotoDataUrl(photoDataUrl, sizePx);

  return promise.then((result) => {
    photoCache.set(key, result);
    return result;
  });
}

export function preparePdfCircularPhotoDataUrl(
  photoDataUrl: string,
  sizePx = DEFAULT_PDF_PHOTO_SIZE_PX,
): Promise<string> {
  return preparePdfProfilePhotoDataUrl(photoDataUrl, { shape: 'circle', sizePx });
}

export type PreparePdfRectPhotoOptions = {
  widthPx: number;
  heightPx: number;
  mimeType?: 'image/jpeg' | 'image/png';
};

function rectCacheKey(dataUrl: string, options: PreparePdfRectPhotoOptions): string {
  const mimeType = options.mimeType ?? 'image/jpeg';
  return `rect:${options.widthPx}x${options.heightPx}:${mimeType}:${dataUrl.length}:${dataUrl.slice(0, 96)}`;
}

/** Cover-crops a source photo into a plain rectangle — no clip mask, no border fill. */
export function createRectPhotoDataUrl(
  photoDataUrl: string,
  widthPx: number,
  heightPx: number,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  return loadImage(photoDataUrl).then((img) => {
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error('PDF_PHOTO_DIMENSIONS_MISSING');
    }

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF_PHOTO_CANVAS_MISSING');

    const crop = coverCropRect(sourceWidth, sourceHeight, widthPx, heightPx);
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
    return mimeType === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92);
  });
}

export function preparePdfRectPhotoDataUrl(
  photoDataUrl: string,
  options: PreparePdfRectPhotoOptions,
): Promise<string> {
  const key = rectCacheKey(photoDataUrl, options);
  const cached = photoCache.get(key);
  if (cached) return Promise.resolve(cached);

  const mimeType = options.mimeType ?? 'image/jpeg';
  return createRectPhotoDataUrl(photoDataUrl, options.widthPx, options.heightPx, mimeType).then((result) => {
    photoCache.set(key, result);
    return result;
  });
}

/** Inserts an unframed rectangular photo — no rings, fills, or clipping paths. */
export function drawRectPdfPhoto(
  pdf: PdfPhotoWriter,
  photoDataUrl: string,
  x: number,
  y: number,
  widthMm: number,
  heightMm: number,
  format: 'JPEG' | 'PNG' = 'JPEG',
): void {
  try {
    pdf.addImage(photoDataUrl, format, x, y, widthMm, heightMm, undefined, 'FAST');
  } catch {
    pdf.addImage(photoDataUrl, format, x, y, widthMm, heightMm);
  }
}

export function preparePdfSquarePhotoDataUrl(
  photoDataUrl: string,
  sizePx: number,
): Promise<string> {
  return preparePdfRectPhotoDataUrl(photoDataUrl, { widthPx: sizePx, heightPx: sizePx });
}

export function drawPdfPhotoBorder(
  pdf: PdfPhotoWriter,
  cx: number,
  cy: number,
  radiusMm: number,
  options: DrawCircularPdfPhotoOptions,
): void {
  const borders = options.borders ?? (
    options.borderColor
      ? [{
        color: options.borderColor,
        lineWidth: options.borderWidth ?? 1,
        radiusDelta: options.borderRadiusDelta ?? 0,
      }]
      : []
  );

  for (const border of borders) {
    pdf.setDrawColor(border.color[0], border.color[1], border.color[2]);
    pdf.setLineWidth(border.lineWidth);
    pdf.circle(cx, cy, radiusMm + border.radiusDelta, 'S');
  }
}

export function drawCircularPdfPhoto(
  pdf: PdfPhotoWriter,
  photoDataUrl: string,
  cx: number,
  cy: number,
  radiusMm: number,
  options: DrawCircularPdfPhotoOptions = {},
): void {
  const diameter = radiusMm * 2;
  const x = cx - radiusMm;
  const y = cy - radiusMm;

  if (options.outerFill) {
    pdf.setFillColor(options.outerFill[0], options.outerFill[1], options.outerFill[2]);
    pdf.circle(cx, cy, radiusMm + (options.outerRadiusDelta ?? 0.6), 'F');
  }

  try {
    pdf.addImage(photoDataUrl, 'PNG', x, y, diameter, diameter, undefined, 'FAST');
  } catch {
    pdf.addImage(photoDataUrl, 'PNG', x, y, diameter, diameter);
  }

  drawPdfPhotoBorder(pdf, cx, cy, radiusMm, options);
}

export function inspectCircularPhotoDataUrl(dataUrl: string): Promise<CircularPhotoInspection> {
  return loadImage(dataUrl).then((img) => {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF_PHOTO_INSPECTION_CANVAS_MISSING');

    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const read = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      return {
        r: imageData.data[idx] ?? 0,
        g: imageData.data[idx + 1] ?? 0,
        b: imageData.data[idx + 2] ?? 0,
        a: imageData.data[idx + 3] ?? 0,
      };
    };

    const corners = [
      read(0, 0),
      read(width - 1, 0),
      read(0, height - 1),
      read(width - 1, height - 1),
    ];
    const center = read(Math.floor(width / 2), Math.floor(height / 2));

    return {
      isPng: dataUrl.startsWith('data:image/png'),
      width,
      height,
      hasTransparentCorners: corners.every((pixel) => pixel.a < 16),
      hasOpaqueCenter: center.a > 200,
    };
  });
}
