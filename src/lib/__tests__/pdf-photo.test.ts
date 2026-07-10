/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  clearPdfPhotoCache,
  createCircularPhotoDataUrl,
  createRectPhotoDataUrl,
  drawCircularPdfPhoto,
  drawRectPdfPhoto,
  inspectCircularPhotoDataUrl,
  preparePdfProfilePhotoDataUrl,
  preparePdfRectPhotoDataUrl,
} from '@/lib/pdf-photo';

const portraitPhoto = `data:image/jpeg;base64,${Buffer.from('portrait-photo-source').toString('base64')}`;
const transparentCirclePhoto = `data:image/png;base64,${Buffer.from('transparent-circle-photo').toString('base64')}`;
let drawImageCalls: unknown[][] = [];

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 400;
  naturalHeight = 600;
  width = 400;
  height = 600;
  private _src = '';

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }

  get src() {
    return this._src;
  }
}

beforeEach(() => {
  drawImageCalls = [];
  clearPdfPhotoCache();
  vi.stubGlobal('Image', MockImage as unknown as typeof Image);

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      drawImage: vi.fn((...args: unknown[]) => {
        drawImageCalls.push(args);
      }),
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const idx = (y * width + x) * 4;
            const corner = x === 0 || y === 0 || x === width - 1 || y === height - 1;
            data[idx] = corner ? 0 : 120;
            data[idx + 1] = corner ? 0 : 80;
            data[idx + 2] = corner ? 0 : 40;
            data[idx + 3] = corner ? 0 : 255;
          }
        }
        return { data };
      }),
      globalCompositeOperation: 'source-over',
    })),
    configurable: true,
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn((type?: string) => {
      if (type === 'image/jpeg') return 'data:image/jpeg;base64,rect-photo';
      expect(type).toBe('image/png');
      return transparentCirclePhoto;
    }),
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearPdfPhotoCache();
});

describe('pdf-photo helpers', () => {
  test('cover-crops non-square portrait input without distortion', async () => {
    const result = await createCircularPhotoDataUrl(portraitPhoto, 256);

    expect(result).toBe(transparentCirclePhoto);
    expect(drawImageCalls).toHaveLength(1);
    const [, , , , , dx, dy, scaledW, scaledH] = drawImageCalls[0] as [unknown, number, number, number, number, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(-64);
    expect(scaledW).toBe(256);
    expect(scaledH).toBe(384);
  });

  test('circular output is a PNG data URL with transparent corners', async () => {
    const result = await preparePdfProfilePhotoDataUrl(portraitPhoto, { shape: 'circle', sizePx: 256 });
    const inspection = await inspectCircularPhotoDataUrl(result);

    expect(result.startsWith('data:image/png')).toBe(true);
    expect(inspection.isPng).toBe(true);
    expect(inspection.hasTransparentCorners).toBe(true);
    expect(inspection.hasOpaqueCenter).toBe(true);
  });

  test('preparePdfProfilePhotoDataUrl caches repeated calls', async () => {
    const first = await preparePdfProfilePhotoDataUrl(portraitPhoto, { shape: 'circle', sizePx: 256 });
    const second = await preparePdfProfilePhotoDataUrl(portraitPhoto, { shape: 'circle', sizePx: 256 });

    expect(first).toBe(second);
    expect(drawImageCalls).toHaveLength(1);
  });

  test('drawCircularPdfPhoto inserts masked PNG and draws border ring', () => {
    const pdf = {
      setFillColor: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      circle: vi.fn(),
      addImage: vi.fn(),
    };

    drawCircularPdfPhoto(pdf, transparentCirclePhoto, 180, 25, 14, {
      outerFill: [255, 255, 255],
      outerRadiusDelta: 0.6,
      borders: [
        { color: [15, 23, 42], lineWidth: 2.2, radiusDelta: 0.3 },
        { color: [212, 175, 55], lineWidth: 0.45, radiusDelta: 0.65 },
      ],
    });

    expect(pdf.addImage).toHaveBeenCalledWith(
      transparentCirclePhoto,
      'PNG',
      166,
      11,
      28,
      28,
      undefined,
      'FAST',
    );
    expect(pdf.circle).toHaveBeenCalled();
  });

  test('rect photo helper cover-crops portrait input to JPEG without circular clip', async () => {
    const result = await createRectPhotoDataUrl(portraitPhoto, 216, 288, 'image/jpeg');
    expect(result).toBe('data:image/jpeg;base64,rect-photo');
    expect(drawImageCalls).toHaveLength(1);
    const [, , , , , dx, dy, scaledW, scaledH] = drawImageCalls[0] as [unknown, number, number, number, number, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(-18);
    expect(scaledW).toBe(216);
    expect(scaledH).toBe(324);
  });

  test('drawRectPdfPhoto inserts unframed JPEG without borders', () => {
    const pdf = {
      setFillColor: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      circle: vi.fn(),
      addImage: vi.fn(),
    };

    drawRectPdfPhoto(pdf, 'data:image/jpeg;base64,rect-photo', 99.75, 6, 10.5, 14, 'JPEG');

    expect(pdf.addImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,rect-photo',
      'JPEG',
      99.75,
      6,
      10.5,
      14,
      undefined,
      'FAST',
    );
    expect(pdf.circle).not.toHaveBeenCalled();
    expect(pdf.setDrawColor).not.toHaveBeenCalled();
  });

  test('preparePdfRectPhotoDataUrl caches repeated calls', async () => {
    const first = await preparePdfRectPhotoDataUrl(portraitPhoto, { widthPx: 216, heightPx: 288 });
    const second = await preparePdfRectPhotoDataUrl(portraitPhoto, { widthPx: 216, heightPx: 288 });
    expect(first).toBe(second);
    expect(drawImageCalls).toHaveLength(1);
  });
});
