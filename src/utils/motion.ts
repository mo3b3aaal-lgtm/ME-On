import { useState, useEffect, useCallback, useRef } from 'react';

export type AnimationSpeed = 'fast' | 'balanced' | 'relaxed';

export const MOTION_SPEED_STORAGE_KEY = 'tm_app_animation_speed_v1';
export const DEFAULT_ANIMATION_SPEED: AnimationSpeed = 'relaxed';
const MOTION_CHANGE_EVENT = 'classy-motion-speed-change';

export interface MotionPreset {
  speed: AnimationSpeed;
  /** Primary entrance duration for profiles, lesson studios, panels & bottom sheets */
  enterDurationMs: number;
  /** Coordinated reverse exit duration for panels, profiles & sheets */
  exitDurationMs: number;
  /** Full-screen / tab / nested page transition duration */
  screenDurationMs: number;
  /** Backdrop fade-in duration */
  backdropEnterMs: number;
  /** Backdrop fade-out duration */
  backdropExitMs: number;
  /** List / lesson / student card entrance duration */
  cardDurationMs: number;
  /** Toast notification entrance duration */
  toastDurationMs: number;
  /** Smooth decelerating ease-out entrance curve (zero bounce / overshoot) */
  enterEasing: string;
  /** Gentle coordinated reverse exit curve */
  exitEasing: string;
  /** Upward entrance distance for Student Profile & Lesson Studios (px) */
  detailRisePx: number;
  /** Downward exit distance for Student Profile & Lesson Studios (px) */
  detailExitDropPx: number;
  /** Upward entrance distance for standard drawers & action sheets (px) */
  sheetRisePx: number;
  /** Upward entrance distance for compact dialogs & confirmation cards (px) */
  dialogRisePx: number;
  /** Subtle upward entrance distance for list/timeline cards (px) */
  cardRisePx: number;
}

const ENTER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EXIT_EASING = 'cubic-bezier(0.32, 0, 0.67, 0)';

export const MOTION_PRESETS: Record<AnimationSpeed, MotionPreset> = {
  fast: {
    speed: 'fast',
    enterDurationMs: 205,
    exitDurationMs: 165,
    screenDurationMs: 185,
    backdropEnterMs: 190,
    backdropExitMs: 155,
    cardDurationMs: 195,
    toastDurationMs: 190,
    enterEasing: ENTER_EASING,
    exitEasing: EXIT_EASING,
    detailRisePx: 22,
    detailExitDropPx: 16,
    sheetRisePx: 20,
    dialogRisePx: 16,
    cardRisePx: 12,
  },
  balanced: {
    speed: 'balanced',
    enterDurationMs: 320,
    exitDurationMs: 235,
    screenDurationMs: 265,
    backdropEnterMs: 280,
    backdropExitMs: 215,
    cardDurationMs: 270,
    toastDurationMs: 260,
    enterEasing: ENTER_EASING,
    exitEasing: EXIT_EASING,
    detailRisePx: 24,
    detailExitDropPx: 18,
    sheetRisePx: 22,
    dialogRisePx: 17,
    cardRisePx: 13,
  },
  relaxed: {
    speed: 'relaxed',
    enterDurationMs: 450,
    exitDurationMs: 310,
    screenDurationMs: 360,
    backdropEnterMs: 380,
    backdropExitMs: 285,
    cardDurationMs: 350,
    toastDurationMs: 340,
    enterEasing: ENTER_EASING,
    exitEasing: EXIT_EASING,
    detailRisePx: 26,
    detailExitDropPx: 20,
    sheetRisePx: 24,
    dialogRisePx: 18,
    cardRisePx: 14,
  },
};

let memoryFallbackSpeed: AnimationSpeed | null = null;
let listenersInitialized = false;

function parseAnimationSpeed(raw: string | null): AnimationSpeed | null {
  if (raw === 'fast' || raw === 'balanced' || raw === 'relaxed') {
    return raw;
  }
  return null;
}

/**
 * Checks whether the operating system / browser requests reduced motion.
 * System reduced-motion accessibility is always respected and never overridden.
 */
export function isSystemReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Synchronously reads the user's persisted Animation Speed preference.
 * Defaults to 'relaxed' (هادئ) when no preference has been saved yet.
 */
export function getAnimationSpeed(): AnimationSpeed {
  if (typeof window === 'undefined') {
    return memoryFallbackSpeed ?? DEFAULT_ANIMATION_SPEED;
  }
  try {
    const parsed = parseAnimationSpeed(window.localStorage.getItem(MOTION_SPEED_STORAGE_KEY));
    if (parsed !== null) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors in restricted WebViews
  }
  return memoryFallbackSpeed ?? DEFAULT_ANIMATION_SPEED;
}

/**
 * Returns the active MotionPreset for the given or stored speed.
 */
export function getMotionPreset(speed?: AnimationSpeed): MotionPreset {
  const target = speed ?? getAnimationSpeed();
  return MOTION_PRESETS[target] ?? MOTION_PRESETS.relaxed;
}

/**
 * Returns the effective JS unmount delay in ms for exit animations,
 * respecting OS `prefers-reduced-motion: reduce`.
 */
export function getEffectiveExitDurationMs(speed?: AnimationSpeed): number {
  if (isSystemReducedMotion()) {
    return 0;
  }
  return getMotionPreset(speed).exitDurationMs;
}

/**
 * Synchronizes centralized motion CSS custom properties onto `document.documentElement`
 * so all CSS keyframes and transitions update immediately without restarting the app.
 */
export function applyMotionVariablesToDocument(speed?: AnimationSpeed): void {
  if (typeof document === 'undefined') return;
  const resolvedSpeed = speed ?? getAnimationSpeed();
  const preset = getMotionPreset(resolvedSpeed);
  const reduced = isSystemReducedMotion();
  const root = document.documentElement;

  root.dataset.motionSpeed = resolvedSpeed;
  root.dataset.reducedMotion = reduced ? 'true' : 'false';

  if (reduced) {
    root.style.setProperty('--motion-enter-duration', '0.01ms');
    root.style.setProperty('--motion-exit-duration', '0.01ms');
    root.style.setProperty('--motion-screen-duration', '0.01ms');
    root.style.setProperty('--motion-backdrop-enter-duration', '0.01ms');
    root.style.setProperty('--motion-backdrop-exit-duration', '0.01ms');
    root.style.setProperty('--motion-card-duration', '0.01ms');
    root.style.setProperty('--motion-toast-duration', '0.01ms');
    root.style.setProperty('--motion-rise-detail', '0px');
    root.style.setProperty('--motion-drop-detail', '0px');
    root.style.setProperty('--motion-rise-sheet', '0px');
    root.style.setProperty('--motion-rise-dialog', '0px');
    root.style.setProperty('--motion-rise-card', '0px');
    root.style.setProperty('--nav-transition-duration', '0.01ms');
    return;
  }

  root.style.setProperty('--motion-enter-duration', `${preset.enterDurationMs}ms`);
  root.style.setProperty('--motion-exit-duration', `${preset.exitDurationMs}ms`);
  root.style.setProperty('--motion-screen-duration', `${preset.screenDurationMs}ms`);
  root.style.setProperty('--motion-backdrop-enter-duration', `${preset.backdropEnterMs}ms`);
  root.style.setProperty('--motion-backdrop-exit-duration', `${preset.backdropExitMs}ms`);
  root.style.setProperty('--motion-card-duration', `${preset.cardDurationMs}ms`);
  root.style.setProperty('--motion-toast-duration', `${preset.toastDurationMs}ms`);
  root.style.setProperty('--motion-ease-enter', preset.enterEasing);
  root.style.setProperty('--motion-ease-exit', preset.exitEasing);
  root.style.setProperty('--motion-rise-detail', `${preset.detailRisePx}px`);
  root.style.setProperty('--motion-drop-detail', `${preset.detailExitDropPx}px`);
  root.style.setProperty('--motion-rise-sheet', `${preset.sheetRisePx}px`);
  root.style.setProperty('--motion-rise-dialog', `${preset.dialogRisePx}px`);
  root.style.setProperty('--motion-rise-card', `${preset.cardRisePx}px`);
  root.style.setProperty('--nav-transition-duration', `${preset.screenDurationMs}ms`);
  root.style.setProperty('--nav-transition-ease', preset.enterEasing);
}

/**
 * Initializes the global motion speed preference synchronously before first render
 * and subscribes once to cross-tab storage & OS reduced-motion changes.
 */
export function initMotionPreference(): AnimationSpeed {
  const current = getAnimationSpeed();
  applyMotionVariablesToDocument(current);

  if (typeof window !== 'undefined' && !listenersInitialized) {
    listenersInitialized = true;

    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === null || e.key === MOTION_SPEED_STORAGE_KEY) {
        memoryFallbackSpeed = null;
        const updated = getAnimationSpeed();
        applyMotionVariablesToDocument(updated);
        window.dispatchEvent(
          new CustomEvent<AnimationSpeed>(MOTION_CHANGE_EVENT, { detail: updated })
        );
      }
    });

    try {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleReducedChange = () => {
        const active = getAnimationSpeed();
        applyMotionVariablesToDocument(active);
        window.dispatchEvent(
          new CustomEvent<AnimationSpeed>(MOTION_CHANGE_EVENT, { detail: active })
        );
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handleReducedChange);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(handleReducedChange);
      }
    } catch {
      // Ignore matchMedia listener errors on legacy WebViews
    }
  }

  return current;
}

/**
 * Updates and persists the global Animation Speed immediately across the entire app.
 */
export function setAnimationSpeed(speed: AnimationSpeed): void {
  const validSpeed: AnimationSpeed =
    speed === 'fast' || speed === 'balanced' || speed === 'relaxed'
      ? speed
      : DEFAULT_ANIMATION_SPEED;

  memoryFallbackSpeed = validSpeed;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MOTION_SPEED_STORAGE_KEY, validSpeed);
      memoryFallbackSpeed = null;
    } catch {
      // Retain memoryFallbackSpeed if localStorage write is restricted
    }
    applyMotionVariablesToDocument(validSpeed);
    window.dispatchEvent(
      new CustomEvent<AnimationSpeed>(MOTION_CHANGE_EVENT, { detail: validSpeed })
    );
  }
}

/**
 * React hook for reading and updating the global Animation Speed preference.
 */
export function useMotionPreference() {
  const [animationSpeed, setSpeedState] = useState<AnimationSpeed>(() => getAnimationSpeed());
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(() => isSystemReducedMotion());

  useEffect(() => {
    const syncState = (e?: Event) => {
      setIsReducedMotion(isSystemReducedMotion());
      if (e && 'detail' in e) {
        const detail = (e as CustomEvent<AnimationSpeed>).detail;
        if (detail === 'fast' || detail === 'balanced' || detail === 'relaxed') {
          setSpeedState(detail);
          return;
        }
      }
      setSpeedState(getAnimationSpeed());
    };

    window.addEventListener(MOTION_CHANGE_EVENT, syncState);
    return () => {
      window.removeEventListener(MOTION_CHANGE_EVENT, syncState);
    };
  }, []);

  const updateSpeed = useCallback((nextSpeed: AnimationSpeed) => {
    setAnimationSpeed(nextSpeed);
    setSpeedState(nextSpeed);
  }, []);

  return {
    animationSpeed,
    setAnimationSpeed: updateSpeed,
    isReducedMotion,
    preset: getMotionPreset(animationSpeed),
  };
}

/**
 * Keeps a boolean-controlled overlay or sheet mounted for the exact duration
 * of its reverse exit animation and cleans up timers safely on unmount.
 */
export function useAnimatedPresence(isOpen: boolean): {
  shouldRender: boolean;
  isClosing: boolean;
} {
  const [isExiting, setIsExiting] = useState(false);
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      setIsExiting(false);
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const exitMs = getEffectiveExitDurationMs();
      if (exitMs <= 0) {
        setIsExiting(false);
        return;
      }
      setIsExiting(true);
      const timer = window.setTimeout(() => {
        setIsExiting(false);
      }, exitMs);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  return {
    shouldRender: isOpen || isExiting,
    isClosing: !isOpen && isExiting,
  };
}

/**
 * Manages entity-bound detail modals (Student Profile, Group Profile, Lesson Studio)
 * with coordinated exit retention that dynamically respects the current Animation Speed.
 */
export function useAnimatedModalState<T>() {
  const [item, setItem] = useState<T | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const open = useCallback((nextItem: T) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setItem(nextItem);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    const exitMs = getEffectiveExitDurationMs();
    if (exitMs <= 0) {
      setItem(null);
      return;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setItem(null);
      closeTimerRef.current = null;
    }, exitMs);
  }, []);

  return { item, setItem, isOpen, open, close };
}
