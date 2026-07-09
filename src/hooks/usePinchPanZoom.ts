'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Transform = { scale: number; x: number; y: number };

type TouchLike = { clientX: number; clientY: number };

function touchDistance(t1: TouchLike, t2: TouchLike): number {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

/** Lightweight pinch-to-zoom + pan for fullscreen template preview only. */
export function usePinchPanZoom(enabled: boolean) {
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const gestureRef = useRef({
    scale: 1,
    x: 0,
    y: 0,
    pinchStartScale: 1,
    pinchStartDist: 0,
    panStart: null as { x: number; y: number } | null,
    panOrigin: null as { x: number; y: number } | null,
  });

  const apply = useCallback((next: Transform) => {
    gestureRef.current.scale = next.scale;
    gestureRef.current.x = next.x;
    gestureRef.current.y = next.y;
    setTransform(next);
  }, []);

  const reset = useCallback(() => {
    gestureRef.current.pinchStartDist = 0;
    gestureRef.current.panStart = null;
    gestureRef.current.panOrigin = null;
    apply({ scale: 1, x: 0, y: 0 });
  }, [apply]);

  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const g = gestureRef.current;
    if (e.touches.length === 2) {
      g.pinchStartDist = touchDistance(e.touches[0]!, e.touches[1]!);
      g.pinchStartScale = g.scale;
      g.panStart = null;
    } else if (e.touches.length === 1 && g.scale > 1) {
      g.panStart = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      g.panOrigin = { x: g.x, y: g.y };
    }
  }, [enabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const g = gestureRef.current;
    if (e.touches.length === 2 && g.pinchStartDist > 0) {
      const dist = touchDistance(e.touches[0]!, e.touches[1]!);
      const ratio = dist / g.pinchStartDist;
      const nextScale = Math.min(4, Math.max(1, g.pinchStartScale * ratio));
      apply({ scale: nextScale, x: g.x, y: g.y });
    } else if (e.touches.length === 1 && g.panStart && g.panOrigin && g.scale > 1) {
      const dx = e.touches[0]!.clientX - g.panStart.x;
      const dy = e.touches[0]!.clientY - g.panStart.y;
      apply({ scale: g.scale, x: g.panOrigin.x + dx, y: g.panOrigin.y + dy });
    }
  }, [apply, enabled]);

  const onTouchEnd = useCallback(() => {
    gestureRef.current.pinchStartDist = 0;
    gestureRef.current.panStart = null;
    gestureRef.current.panOrigin = null;
    if (gestureRef.current.scale <= 1.02) reset();
  }, [reset]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!enabled) return;
    e.preventDefault();
    const g = gestureRef.current;
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const nextScale = Math.min(4, Math.max(1, g.scale + delta));
    if (nextScale <= 1.02) {
      reset();
      return;
    }
    apply({ scale: nextScale, x: g.x, y: g.y });
  }, [apply, enabled, reset]);

  return {
    transform,
    reset,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
    isZoomed: transform.scale > 1.02,
  };
}
