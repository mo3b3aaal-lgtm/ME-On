import React, { useRef, useCallback } from 'react';

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventScrollOnHorizontal?: boolean;
}

export interface TouchGestureProps {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Custom hook for smooth, native-feeling swipe & drag gestures on mobile devices.
 * Respects vertical vs horizontal scroll intent to prevent interfering with normal page scrolling.
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 45,
}: SwipeHandlers): TouchGestureProps {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    touchDeltaRef.current = { dx: 0, dy: 0 };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchDeltaRef.current = {
      dx: touch.clientX - touchStartRef.current.x,
      dy: touch.clientY - touchStartRef.current.y,
    };
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;
    const { dx, dy } = touchDeltaRef.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const timeTaken = Date.now() - touchStartRef.current.time;

    // Reset touch start
    touchStartRef.current = null;

    // Fast flick or passed threshold
    const isQuickFlick = timeTaken < 300 && (absX > 25 || absY > 25);

    if (absX > absY && (absX > threshold || (isQuickFlick && absX > 25))) {
      // Horizontal swipe
      if (dx < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    } else if (absY > absX && (absY > threshold || (isQuickFlick && absY > 25))) {
      // Vertical swipe
      if (dy < 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
