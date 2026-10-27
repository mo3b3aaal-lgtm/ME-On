import React, { useRef, useCallback, useEffect } from 'react';
import { ActiveTab } from '../types';
import { triggerLightHaptic } from './haptics';

export const TOP_LEVEL_NAV_ORDER = ['dashboard', 'sessions', 'reports', 'students'] as const;
export type TopLevelNavTab = (typeof TOP_LEVEL_NAV_ORDER)[number];

export function normalizeTopLevelTab(tab: ActiveTab): TopLevelNavTab | null {
  if (tab === 'groups' || tab === 'students') return 'students';
  if (tab === 'dashboard' || tab === 'sessions' || tab === 'reports') return tab;
  return null;
}

function resolveElementIsRTL(el: HTMLElement | null): boolean {
  if (el) {
    const dirHost = el.closest('[dir]');
    if (dirHost) {
      return dirHost.getAttribute('dir') === 'rtl';
    }
    if (typeof window !== 'undefined') {
      return window.getComputedStyle(el).direction === 'rtl';
    }
  }
  if (typeof document !== 'undefined') {
    return (document.documentElement.getAttribute('dir') || 'rtl') === 'rtl';
  }
  return true;
}

/**
 * Resolves the target top-level tab for a horizontal swipe gesture:
 * - Left-to-right swipe (dx > 0) navigates to the page visually on the LEFT
 *   (index + 1 in RTL, index - 1 in LTR) and enters from the left.
 * - Right-to-left swipe (dx < 0) navigates to the page visually on the RIGHT
 *   (index - 1 in RTL, index + 1 in LTR) and enters from the right.
 * - Never wraps around at the first or last tab.
 */
export function resolveSwipeTargetTab(
  activeTab: ActiveTab,
  dx: number,
  isRTL = true
): { targetTab: TopLevelNavTab; direction: 'forward' | 'backward' } | null {
  const normalized = normalizeTopLevelTab(activeTab);
  if (!normalized || dx === 0) return null;

  const currentIndex = TOP_LEVEL_NAV_ORDER.indexOf(normalized);
  if (currentIndex === -1) return null;

  if (dx > 0) {
    // Swipe LEFT -> RIGHT: navigate to the page on the LEFT
    const targetIndex = isRTL ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= TOP_LEVEL_NAV_ORDER.length) return null;
    return {
      targetTab: TOP_LEVEL_NAV_ORDER[targetIndex],
      direction: 'backward',
    };
  }

  // Swipe RIGHT -> LEFT (dx < 0): navigate to the page on the RIGHT
  const targetIndex = isRTL ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= TOP_LEVEL_NAV_ORDER.length) return null;
  return {
    targetTab: TOP_LEVEL_NAV_ORDER[targetIndex],
    direction: 'forward',
  };
}

export function isEdgeTouchExcluded(
  clientX: number,
  viewportWidth: number,
  edgeSafeZonePx = 24
): boolean {
  if (viewportWidth <= 0) return false;
  return clientX <= edgeSafeZonePx || clientX >= viewportWidth - edgeSafeZonePx;
}

export function evaluatePageSwipeCommit(
  dx: number,
  dy: number,
  velocityPxPerMs: number,
  distanceThreshold = 64,
  flickMinDistance = 34,
  flickVelocityThreshold = 0.42
): boolean {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < absY * 1.35) return false;
  if (absX >= distanceThreshold) return true;
  if (
    absX >= flickMinDistance &&
    Math.abs(velocityPxPerMs) >= flickVelocityThreshold &&
    Math.sign(velocityPxPerMs) === Math.sign(dx)
  ) {
    return true;
  }
  return false;
}

export function computeSwipeTrackOffset(dx: number, canNavigateInDirection: boolean): number {
  const sign = Math.sign(dx);
  const absX = Math.abs(dx);
  if (absX <= 10) return 0;
  const effectiveDelta = (absX - 10) * sign;
  if (!canNavigateInDirection) {
    // Subtle edge resistance when at first/last tab
    return Math.max(-10, Math.min(10, effectiveDelta * 0.08));
  }
  // Restrained, finger-following offset capped at +-40px
  return Math.max(-40, Math.min(40, effectiveDelta * 0.32));
}

function isInteractiveOrHorizontalScrollTarget(
  target: EventTarget | null,
  boundaryEl: HTMLElement | null
): boolean {
  if (!target || !(target instanceof Element)) return false;

  if (
    target.closest(
      'input, textarea, select, option, [contenteditable="true"], [role="slider"], [role="spinbutton"], [data-no-page-swipe="true"], .recharts-wrapper, .segmented-control, [role="tablist"]'
    )
  ) {
    return true;
  }

  let node: Element | null = target;
  while (node && node !== boundaryEl && node !== document.body) {
    if (node instanceof HTMLElement) {
      if (
        node.classList.contains('horizontal-scroll-row') ||
        node.classList.contains('horizontal-row-snap') ||
        node.classList.contains('scroll-snap-x')
      ) {
        return true;
      }
      if (node.scrollWidth > node.clientWidth + 4 && typeof window !== 'undefined') {
        const overflowX = window.getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          return true;
        }
      }
    }
    node = node.parentElement;
  }

  return false;
}

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
 * General swipe gesture hook for component-level interactions (e.g., modal header swipe-down, sub-tabs).
 * Respects vertical vs horizontal scroll intent and ignores inputs and horizontal chip scrollers.
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 45,
}: SwipeHandlers): TouchGestureProps {
  const touchStartRef = useRef<{ x: number; y: number; time: number; ignoreHorizontal: boolean } | null>(null);
  const touchDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const ignoreHorizontal = isInteractiveOrHorizontalScrollTarget(
      e.target,
      e.currentTarget instanceof HTMLElement ? e.currentTarget : null
    );
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      ignoreHorizontal,
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
    const { ignoreHorizontal, time } = touchStartRef.current;
    const { dx, dy } = touchDeltaRef.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const timeTaken = Date.now() - time;

    touchStartRef.current = null;

    const isQuickFlick = timeTaken < 300 && (absX > 25 || absY > 25);

    if (!ignoreHorizontal && absX > absY * 1.25 && (absX > threshold || (isQuickFlick && absX > 25))) {
      if (dx < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    } else if (absY > absX * 1.25 && (absY > threshold || (isQuickFlick && absY > 25))) {
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

export interface UsePageSwipeNavigationOptions {
  activeTab: ActiveTab;
  disabled: boolean;
  onSwipeNavigate: (
    targetTab: TopLevelNavTab,
    direction: 'forward' | 'backward',
    settledByDrag?: boolean
  ) => void;
  onEnsureTabMounted?: (targetTab: TopLevelNavTab) => void;
}

function clearPanelInlineStyle(el: HTMLElement | null): void {
  if (!el) return;
  el.style.transition = '';
  el.style.transform = '';
  el.style.opacity = '';
  el.style.visibility = '';
  el.style.zIndex = '';
  el.style.pointerEvents = '';
  el.style.willChange = '';
}

/**
 * High-performance horizontal swipe navigation hook for Classy's top-level pages.
 * - Live 1:1 finger tracking across current & adjacent tab panels using pure GPU translate3d + opacity
 * - Zero React re-renders during drag; velocity-aware smooth settle on commit or snap-back on cancel
 * - Preserves exact Classy swipe direction mapping, non-wrapping boundaries, and OS edge-back exclusion
 */
export function usePageSwipeNavigation({
  activeTab,
  disabled,
  onSwipeNavigate,
  onEnsureTabMounted,
}: UsePageSwipeNavigationOptions) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef<number>(0);

  const gestureRef = useRef<{
    active: boolean;
    axis: 'x' | 'y' | null;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityX: number;
    dx: number;
    dy: number;
    reducedMotion: boolean;
    isRTL: boolean;
    currentPanel: HTMLElement | null;
    peekPanel: HTMLElement | null;
    peekTab: TopLevelNavTab | null;
    trackedDualPanel: boolean;
    ensuredTabs: Set<TopLevelNavTab>;
  }>({
    active: false,
    axis: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
    dx: 0,
    dy: 0,
    reducedMotion: false,
    isRTL: true,
    currentPanel: null,
    peekPanel: null,
    peekTab: null,
    trackedDualPanel: false,
    ensuredTabs: new Set(),
  });

  const clearStageInlineStyles = useCallback(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    const stageEl = stageRef.current;
    if (stageEl) {
      stageEl.style.transition = '';
      stageEl.style.transform = '';
      stageEl.style.opacity = '';
      const panels = stageEl.querySelectorAll<HTMLElement>('[data-tab-panel]');
      for (let i = 0; i < panels.length; i++) {
        clearPanelInlineStyle(panels[i]);
      }
    }
    clearPanelInlineStyle(gestureRef.current.currentPanel);
    clearPanelInlineStyle(gestureRef.current.peekPanel);
    gestureRef.current.currentPanel = null;
    gestureRef.current.peekPanel = null;
    gestureRef.current.peekTab = null;
    gestureRef.current.trackedDualPanel = false;
  }, []);

  const animateSnapBack = useCallback(
    (lastDx: number) => {
      const stageEl = stageRef.current;
      const curPanel = gestureRef.current.currentPanel;
      const peekPanel = gestureRef.current.peekPanel;

      if (!stageEl || !curPanel) {
        clearStageInlineStyles();
        return;
      }

      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }

      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      if (reduced || !curPanel.style.transform) {
        clearStageInlineStyles();
        return;
      }

      const stageWidth = Math.max(280, stageEl.clientWidth || 390);
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
      const durationMs = 155;

      curPanel.style.transition = `transform ${durationMs}ms ${ease}, opacity ${durationMs}ms ${ease}`;
      curPanel.style.transform = 'translate3d(0, 0, 0)';
      curPanel.style.opacity = '1';

      if (peekPanel) {
        const parkX = lastDx >= 0 ? -stageWidth : stageWidth;
        peekPanel.style.transition = `transform ${durationMs}ms ${ease}, opacity ${durationMs}ms ${ease}`;
        peekPanel.style.transform = `translate3d(${parkX}px, 0, 0)`;
        peekPanel.style.opacity = '0.9';
      }

      cleanupTimerRef.current = window.setTimeout(() => {
        clearStageInlineStyles();
      }, durationMs + 16);
    },
    [clearStageInlineStyles]
  );

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  // Reset any in-flight drag immediately if disabled (e.g. a modal opens)
  useEffect(() => {
    if (disabled && gestureRef.current.active) {
      gestureRef.current.active = false;
      gestureRef.current.axis = null;
      clearStageInlineStyles();
    }
  }, [disabled, clearStageInlineStyles]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled || e.touches.length !== 1) return;
      if (!normalizeTopLevelTab(activeTab)) return;

      // Extra DOM safety guard if any portal dialog is open
      if (typeof document !== 'undefined' && document.querySelector('[role="dialog"]')) {
        return;
      }

      // Respect active text selection
      if (typeof window !== 'undefined') {
        const sel = window.getSelection?.();
        if (sel && sel.toString().length > 0) return;
      }

      const touch = e.touches[0];
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
      if (isEdgeTouchExcluded(touch.clientX, viewportWidth, 24)) {
        return;
      }

      if (isInteractiveOrHorizontalScrollTarget(e.target, stageRef.current)) {
        return;
      }

      clearStageInlineStyles();

      const now = performance.now();
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const isRTL = resolveElementIsRTL(stageRef.current);

      gestureRef.current = {
        active: true,
        axis: null,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: now,
        velocityX: 0,
        dx: 0,
        dy: 0,
        reducedMotion,
        isRTL,
        currentPanel: null,
        peekPanel: null,
        peekTab: null,
        trackedDualPanel: false,
        ensuredTabs: new Set(),
      };
    },
    [activeTab, disabled, clearStageInlineStyles]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g.active || disabled || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const now = performance.now();
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (g.axis === null) {
        if (absX < 10 && absY < 10) return;
        if (absY >= absX || absX < absY * 1.35) {
          g.axis = 'y';
          g.active = false;
          return;
        }
        g.axis = 'x';
      }

      if (g.axis !== 'x') return;

      const dt = Math.max(1, now - g.lastTime);
      const instantVx = (touch.clientX - g.lastX) / dt;
      g.velocityX = g.velocityX === 0 ? instantVx : g.velocityX * 0.35 + instantVx * 0.65;
      g.lastX = touch.clientX;
      g.lastTime = now;
      g.dx = dx;
      g.dy = dy;

      if (!g.reducedMotion && stageRef.current) {
        const stageEl = stageRef.current;
        const currentMain = normalizeTopLevelTab(activeTab);
        if (!currentMain) return;

        const currentPanel =
          g.currentPanel ||
          stageEl.querySelector<HTMLElement>(`[data-tab-panel="${currentMain}"]`);
        if (!currentPanel) return;
        g.currentPanel = currentPanel;

        const stageWidth = Math.max(280, stageEl.clientWidth || 390);
        const sign = Math.sign(dx);
        const effectiveDx = absX > 8 ? (absX - 8) * sign : 0;
        const candidate = resolveSwipeTargetTab(activeTab, dx, g.isRTL);

        if (candidate) {
          if (!g.ensuredTabs.has(candidate.targetTab)) {
            g.ensuredTabs.add(candidate.targetTab);
            onEnsureTabMounted?.(candidate.targetTab);
          }

          const targetPanel = stageEl.querySelector<HTMLElement>(
            `[data-tab-panel="${candidate.targetTab}"]`
          );

          if (g.peekPanel && g.peekPanel !== targetPanel) {
            clearPanelInlineStyle(g.peekPanel);
            g.peekPanel = null;
            g.peekTab = null;
            g.trackedDualPanel = false;
          }

          const clampedDx = Math.max(-stageWidth, Math.min(stageWidth, effectiveDx));
          const progress = Math.min(1, Math.abs(clampedDx) / stageWidth);

          currentPanel.style.willChange = 'transform, opacity';
          currentPanel.style.transition = 'none';
          currentPanel.style.visibility = 'visible';
          currentPanel.style.zIndex = '1';
          currentPanel.style.transform = `translate3d(${clampedDx.toFixed(1)}px, 0, 0)`;
          currentPanel.style.opacity = (1 - progress * 0.1).toFixed(3);

          if (targetPanel && targetPanel !== currentPanel) {
            const enterX = (dx > 0 ? -stageWidth : stageWidth) + clampedDx;
            targetPanel.style.willChange = 'transform, opacity';
            targetPanel.style.transition = 'none';
            targetPanel.style.visibility = 'visible';
            targetPanel.style.zIndex = '2';
            targetPanel.style.pointerEvents = 'none';
            targetPanel.style.transform = `translate3d(${enterX.toFixed(1)}px, 0, 0)`;
            targetPanel.style.opacity = (0.94 + progress * 0.06).toFixed(3);
            g.peekPanel = targetPanel;
            g.peekTab = candidate.targetTab;
            g.trackedDualPanel = true;
          }
        } else {
          // Outer boundary: never wrap around; apply gentle rubber-band resistance
          if (g.peekPanel) {
            clearPanelInlineStyle(g.peekPanel);
            g.peekPanel = null;
            g.peekTab = null;
            g.trackedDualPanel = false;
          }
          const rubberOffset = Math.max(-18, Math.min(18, effectiveDx * 0.12));
          currentPanel.style.willChange = 'transform';
          currentPanel.style.transition = 'none';
          currentPanel.style.visibility = 'visible';
          currentPanel.style.zIndex = '1';
          currentPanel.style.transform = `translate3d(${rubberOffset.toFixed(1)}px, 0, 0)`;
          currentPanel.style.opacity = '1';
        }
      }
    },
    [activeTab, disabled, onEnsureTabMounted]
  );

  const finishGesture = useCallback(
    (cancelled: boolean) => {
      const g = gestureRef.current;
      if (!g.active) return;
      g.active = false;

      if (g.axis !== 'x') {
        g.axis = null;
        return;
      }

      if (Math.abs(g.dx) > 14) {
        suppressClickUntilRef.current = performance.now() + 90;
      }

      if (cancelled || disabled) {
        g.axis = null;
        animateSnapBack(g.dx);
        return;
      }

      const committed = evaluatePageSwipeCommit(g.dx, g.dy, g.velocityX);
      const resolved = committed ? resolveSwipeTargetTab(activeTab, g.dx, g.isRTL) : null;

      g.axis = null;

      if (resolved) {
        const stageEl = stageRef.current;
        const currentMain = normalizeTopLevelTab(activeTab);
        const currentPanel =
          g.currentPanel ||
          (stageEl && currentMain
            ? stageEl.querySelector<HTMLElement>(`[data-tab-panel="${currentMain}"]`)
            : null);
        const targetPanel = stageEl
          ? stageEl.querySelector<HTMLElement>(`[data-tab-panel="${resolved.targetTab}"]`)
          : null;

        if (!g.reducedMotion && stageEl && currentPanel && targetPanel && currentPanel !== targetPanel) {
          if (cleanupTimerRef.current !== null) {
            window.clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = null;
          }

          if (g.peekPanel && g.peekPanel !== targetPanel) {
            clearPanelInlineStyle(g.peekPanel);
          }

          const stageWidth = Math.max(280, stageEl.clientWidth || 390);
          const traveled = Math.min(stageWidth, Math.max(0, Math.abs(g.dx) - 8));
          const remainingRatio = Math.max(0.25, 1 - traveled / stageWidth);
          const speedBoost = Math.min(45, Math.abs(g.velocityX) * 35);
          const settleMs = Math.round(
            Math.max(125, Math.min(180, 180 * remainingRatio - speedBoost + 45))
          );
          const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

          // If ultra-fast flick committed before targetPanel received a drag frame, prime its start offset
          if (!g.trackedDualPanel || g.peekPanel !== targetPanel) {
            const startEnterX = g.dx > 0 ? -stageWidth : stageWidth;
            targetPanel.style.transition = 'none';
            targetPanel.style.visibility = 'visible';
            targetPanel.style.zIndex = '2';
            targetPanel.style.opacity = '0.94';
            targetPanel.style.transform = `translate3d(${startEnterX}px, 0, 0)`;
            void targetPanel.offsetWidth;
          }

          const exitX = g.dx > 0 ? stageWidth : -stageWidth;
          currentPanel.style.visibility = 'visible';
          currentPanel.style.zIndex = '1';
          currentPanel.style.pointerEvents = 'none';
          currentPanel.style.transition = `transform ${settleMs}ms ${ease}, opacity ${settleMs}ms ${ease}`;
          currentPanel.style.transform = `translate3d(${exitX}px, 0, 0)`;
          currentPanel.style.opacity = '0.88';

          targetPanel.style.visibility = 'visible';
          targetPanel.style.zIndex = '2';
          targetPanel.style.pointerEvents = 'auto';
          targetPanel.style.transition = `transform ${settleMs}ms ${ease}, opacity ${settleMs}ms ${ease}`;
          targetPanel.style.transform = 'translate3d(0, 0, 0)';
          targetPanel.style.opacity = '1';

          g.currentPanel = currentPanel;
          g.peekPanel = targetPanel;

          triggerLightHaptic();
          onSwipeNavigate(resolved.targetTab, resolved.direction, true);

          cleanupTimerRef.current = window.setTimeout(() => {
            clearStageInlineStyles();
          }, settleMs + 16);
        } else {
          clearStageInlineStyles();
          triggerLightHaptic();
          onSwipeNavigate(resolved.targetTab, resolved.direction, false);
        }
      } else {
        animateSnapBack(g.dx);
      }
    },
    [activeTab, disabled, animateSnapBack, clearStageInlineStyles, onSwipeNavigate]
  );

  const onTouchEnd = useCallback(() => {
    finishGesture(false);
  }, [finishGesture]);

  const onTouchCancel = useCallback(() => {
    finishGesture(true);
  }, [finishGesture]);

  const onClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickUntilRef.current > performance.now()) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickUntilRef.current = 0;
    }
  }, []);

  return {
    stageRef,
    swipeBind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      onClickCapture,
    },
  };
}
