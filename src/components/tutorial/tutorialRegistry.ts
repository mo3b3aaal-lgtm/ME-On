import { useEffect, useState, useCallback, useRef } from 'react';

export interface TargetBounds {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/**
 * Checks whether an element is genuinely visible on the active screen/modal
 * and NOT inside an inactive retained TabPanel or hidden subtree.
 */
export function isElementVisibleInActiveStage(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if (el.closest('.tab-panel-inactive')) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  if (el.closest('[inert]')) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

/**
 * Resolves the active visible DOM element matching `[data-tutorial-id="<targetId>"]`.
 * When multiple elements share an ID across retained panels or stacked modals,
 * prioritizes topmost open dialogs/sheets first, then the active tab panel.
 */
export function findActiveTutorialTarget(targetId?: string | null): HTMLElement | null {
  if (!targetId || typeof document === 'undefined') return null;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tutorial-id="${CSS.escape(targetId)}"]`)
  ).filter(isElementVisibleInActiveStage);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Prefer elements inside an open dialog/sheet (topmost last in DOM)
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (candidates[i].closest('[role="dialog"]')) {
      return candidates[i];
    }
  }

  return candidates[candidates.length - 1];
}

export function measureElementBounds(el: HTMLElement): TargetBounds {
  const rect = el.getBoundingClientRect();
  return {
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
  };
}

/**
 * Smoothly scrolls a target element into comfortable viewport visibility if off-screen
 * or obscured near the bottom navigation bar / sticky modal footer.
 */
export function scrollTargetIntoSafeView(el: HTMLElement): void {
  if (typeof window === 'undefined' || !el.isConnected) return;

  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || 800;
  const topSafeMargin = 76;
  const bottomSafeMargin = 136;

  const isComfortablyVisible =
    rect.top >= topSafeMargin && rect.bottom <= vh - bottomSafeMargin;

  if (isComfortablyVisible) return;

  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  try {
    el.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  } catch {
    el.scrollIntoView();
  }
}

export interface UseActiveTargetResult {
  element: HTMLElement | null;
  bounds: TargetBounds | null;
  isSearching: boolean;
  isMissing: boolean;
  recheckNow: () => void;
}

/**
 * Tracks a `data-tutorial-id` target element using event-driven `MutationObserver`,
 * `ResizeObserver`, and passive scroll/resize listeners ONLY while `enabled` is true.
 * Zero polling loops; all observers and listeners are cleanly torn down when inactive.
 */
export function useActiveTutorialTarget(
  targetId: string | undefined,
  enabled: boolean,
  stepKey: string
): UseActiveTargetResult {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [bounds, setBounds] = useState<TargetBounds | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isMissing, setIsMissing] = useState<boolean>(false);

  const scrolledForStepRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);
  const missingTimeoutRef = useRef<number | null>(null);

  const syncTargetAndBounds = useCallback(() => {
    if (!enabled || !targetId) {
      setElement(null);
      setBounds(null);
      setIsSearching(false);
      setIsMissing(false);
      return;
    }

    const found = findActiveTutorialTarget(targetId);
    if (found) {
      if (missingTimeoutRef.current !== null) {
        window.clearTimeout(missingTimeoutRef.current);
        missingTimeoutRef.current = null;
      }
      setElement(found);
      setIsSearching(false);
      setIsMissing(false);

      const scrollToken = `${stepKey}::${targetId}`;
      if (scrolledForStepRef.current !== scrollToken) {
        scrolledForStepRef.current = scrollToken;
        scrollTargetIntoSafeView(found);
      }

      const nextBounds = measureElementBounds(found);
      setBounds((prev) => {
        if (
          prev &&
          Math.abs(prev.top - nextBounds.top) <= 1 &&
          Math.abs(prev.left - nextBounds.left) <= 1 &&
          Math.abs(prev.width - nextBounds.width) <= 1 &&
          Math.abs(prev.height - nextBounds.height) <= 1
        ) {
          return prev;
        }
        return nextBounds;
      });
    } else {
      setElement(null);
      setBounds(null);
    }
  }, [enabled, targetId, stepKey]);

  const scheduleSync = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      syncTargetAndBounds();
    });
  }, [syncTargetAndBounds]);

  useEffect(() => {
    if (!enabled || !targetId || typeof window === 'undefined') {
      setElement(null);
      setBounds(null);
      setIsSearching(false);
      setIsMissing(false);
      return;
    }

    setIsSearching(true);
    setIsMissing(false);
    syncTargetAndBounds();

    // Give lazy-loaded views/sheets up to 950ms to mount before showing Missing Target recovery
    missingTimeoutRef.current = window.setTimeout(() => {
      missingTimeoutRef.current = null;
      const checkAgain = findActiveTutorialTarget(targetId);
      if (!checkAgain) {
        setIsSearching(false);
        setIsMissing(true);
      } else {
        syncTargetAndBounds();
      }
    }, 950);

    const mutationObserver = new MutationObserver(() => {
      scheduleSync();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'data-tutorial-id', 'data-tutorial-active'],
    });

    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('scroll', scheduleSync, { capture: true, passive: true });

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('scroll', scheduleSync, true);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (missingTimeoutRef.current !== null) {
        window.clearTimeout(missingTimeoutRef.current);
        missingTimeoutRef.current = null;
      }
    };
  }, [enabled, targetId, stepKey, syncTargetAndBounds, scheduleSync]);

  // Attach ResizeObserver to the active matched element itself
  useEffect(() => {
    if (!enabled || !element || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      scheduleSync();
    });
    ro.observe(element);
    return () => {
      ro.disconnect();
    };
  }, [enabled, element, scheduleSync]);

  const recheckNow = useCallback(() => {
    if (!enabled || !targetId) return;
    setIsMissing(false);
    setIsSearching(true);
    scrolledForStepRef.current = '';
    syncTargetAndBounds();
    if (missingTimeoutRef.current !== null) {
      window.clearTimeout(missingTimeoutRef.current);
    }
    missingTimeoutRef.current = window.setTimeout(() => {
      missingTimeoutRef.current = null;
      const found = findActiveTutorialTarget(targetId);
      if (!found) {
        setIsSearching(false);
        setIsMissing(true);
      }
    }, 750);
  }, [enabled, targetId, syncTargetAndBounds]);

  return {
    element,
    bounds,
    isSearching,
    isMissing,
    recheckNow,
  };
}
