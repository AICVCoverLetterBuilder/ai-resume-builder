'use client';

export const ELEGANT_FORMAL_PHOTO_WIDTH = 82;
export const ELEGANT_FORMAL_PHOTO_HEIGHT = 109;
export const ELEGANT_FORMAL_PHOTO_EXPORT_SCALE = 3;
export const ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH = ELEGANT_FORMAL_PHOTO_WIDTH * ELEGANT_FORMAL_PHOTO_EXPORT_SCALE;
export const ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT = ELEGANT_FORMAL_PHOTO_HEIGHT * ELEGANT_FORMAL_PHOTO_EXPORT_SCALE;

export type ElegantFormalCropMetrics = {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type ElegantFormalCornerPixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type ElegantFormalPhotoInspection = {
  mimeType: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  cornerPixels: {
    topLeft: ElegantFormalCornerPixel;
    topRight: ElegantFormalCornerPixel;
    bottomLeft: ElegantFormalCornerPixel;
    bottomRight: ElegantFormalCornerPixel;
  };
  hasTransparentCorner: boolean;
  hasArtificialBlackCorners: boolean;
  hasArtificialWhiteCorners: boolean;
};

export type ElegantFormalCanonicalPhotoInput = {
  originalPhoto?: string;
  rectangularPhoto?: string;
};

export type ElegantFormalCanonicalPhotoResult = {
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: typeof ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH;
  height: typeof ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT;
  source: 'original-photo' | 'validated-rectangular';
  metrics?: ElegantFormalCropMetrics;
};

export function getElegantFormalCoverCropMetrics(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth = ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
  targetHeight = ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
): ElegantFormalCropMetrics {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  return {
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    scale,
    offsetX: (targetWidth - scaledWidth) / 2,
    offsetY: (targetHeight - scaledHeight) / 2,
  };
}

function getDataUrlMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)/i);
  return match?.[1]?.toLowerCase() ?? '';
}

export function elegantFormalDataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split('#')[0].split(',')[1];
  if (!base64) throw new Error('Invalid Elegant Formal photo data URL');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readPixel(data: Uint8ClampedArray, width: number, x: number, y: number): ElegantFormalCornerPixel {
  const index = (y * width + x) * 4;
  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 0,
  };
}

function isNearBlack(pixel: ElegantFormalCornerPixel): boolean {
  return pixel.r <= 12 && pixel.g <= 12 && pixel.b <= 12;
}

function isNearWhite(pixel: ElegantFormalCornerPixel): boolean {
  return pixel.r >= 245 && pixel.g >= 245 && pixel.b >= 245;
}

export function inspectElegantFormalPhotoDataUrl(dataUrl: string): Promise<ElegantFormalPhotoInspection> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not inspect Elegant Formal photo'));
        return;
      }
      if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const corners = {
        topLeft: readPixel(imageData.data, canvas.width, 0, 0),
        topRight: readPixel(imageData.data, canvas.width, canvas.width - 1, 0),
        bottomLeft: readPixel(imageData.data, canvas.width, 0, canvas.height - 1),
        bottomRight: readPixel(imageData.data, canvas.width, canvas.width - 1, canvas.height - 1),
      };
      const cornerList = Object.values(corners);
      resolve({
        mimeType: getDataUrlMimeType(dataUrl),
        width: img.naturalWidth,
        height: img.naturalHeight,
        hasAlpha: imageData.data.some((value, index) => index % 4 === 3 && value < 255),
        cornerPixels: corners,
        hasTransparentCorner: cornerList.some(pixel => pixel.a < 255),
        hasArtificialBlackCorners: cornerList.every(isNearBlack),
        hasArtificialWhiteCorners: cornerList.every(isNearWhite),
      });
    };
    img.onerror = () => reject(new Error('Could not load Elegant Formal photo for inspection'));
    img.src = dataUrl;
  });
}

export async function isCleanElegantFormalPortraitPhoto(dataUrl: string): Promise<boolean> {
  try {
    const inspection = await inspectElegantFormalPhotoDataUrl(dataUrl);
    return inspection.mimeType === 'image/jpeg'
      && inspection.width === ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH
      && inspection.height === ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT
      && !inspection.hasAlpha
      && !inspection.hasTransparentCorner
      && !inspection.hasArtificialBlackCorners
      && !inspection.hasArtificialWhiteCorners;
  } catch {
    return false;
  }
}

export async function prepareElegantFormalCanonicalPhoto(
  input: ElegantFormalCanonicalPhotoInput,
): Promise<ElegantFormalCanonicalPhotoResult | null> {
  if (input.originalPhoto) {
    const { dataUrl, metrics } = await createElegantFormalPortraitPhoto(input.originalPhoto);
    return {
      dataUrl,
      bytes: elegantFormalDataUrlToBytes(dataUrl),
      mimeType: 'image/jpeg',
      width: ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
      height: ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
      source: 'original-photo',
      metrics,
    };
  }
  if (input.rectangularPhoto && await isCleanElegantFormalPortraitPhoto(input.rectangularPhoto)) {
    return {
      dataUrl: input.rectangularPhoto,
      bytes: elegantFormalDataUrlToBytes(input.rectangularPhoto),
      mimeType: 'image/jpeg',
      width: ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
      height: ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
      source: 'validated-rectangular',
    };
  }
  return null;
}

export function createElegantFormalPortraitPhoto(
  sourceDataUrl: string,
  targetWidth = ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
  targetHeight = ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
): Promise<{ dataUrl: string; metrics: ElegantFormalCropMetrics }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create Elegant Formal photo canvas'));
        return;
      }
      if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, targetWidth, targetHeight);

      const metrics = getElegantFormalCoverCropMetrics(
        img.naturalWidth,
        img.naturalHeight,
        targetWidth,
        targetHeight,
      );
      ctx.drawImage(
        img,
        metrics.offsetX,
        metrics.offsetY,
        img.naturalWidth * metrics.scale,
        img.naturalHeight * metrics.scale,
      );
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), metrics });
    };
    img.onerror = () => reject(new Error('Could not load Elegant Formal photo source'));
    img.src = sourceDataUrl;
  });
}
