import { useState, useEffect, useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const HAPTICS_STORAGE_KEY = 'tm_app_haptics_v1';
const HAPTICS_CHANGE_EVENT = 'classy-haptics-change';

// In-memory fallback used only when storage access is unavailable or restricted
let memoryFallbackEnabled: boolean | null = null;
let storageListenerInitialized = false;

function parseHapticsValue(raw: string | null): boolean | null {
  if (raw === 'off' || raw === 'false' || raw === '0') return false;
  if (raw === 'on' || raw === 'true' || raw === '1') return true;
  return null;
}

/**
 * Synchronously checks whether user-controlled haptic feedback is enabled.
 * Defaults to true so existing users retain tactile feedback unless disabled in Settings.
 */
export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') {
    return memoryFallbackEnabled ?? true;
  }
  try {
    const parsed = parseHapticsValue(window.localStorage.getItem(HAPTICS_STORAGE_KEY));
    if (parsed !== null) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors in restricted webviews
  }
  return memoryFallbackEnabled ?? true;
}

/**
 * Loads the persisted haptic preference during startup and attaches cross-tab sync once.
 */
export function initHapticsPreference(): boolean {
  const current = isHapticsEnabled();
  if (typeof window !== 'undefined' && !storageListenerInitialized) {
    storageListenerInitialized = true;
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === null || e.key === HAPTICS_STORAGE_KEY) {
        memoryFallbackEnabled = null;
        window.dispatchEvent(
          new CustomEvent<boolean>(HAPTICS_CHANGE_EVENT, { detail: isHapticsEnabled() })
        );
      }
    });
  }
  return current;
}

/**
 * Updates and persists the global haptic feedback preference immediately.
 */
export function setHapticsEnabled(enabled: boolean): void {
  memoryFallbackEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? 'on' : 'off');
      memoryFallbackEnabled = null;
    } catch {
      // Keep memoryFallbackEnabled active if storage write fails
    }
    window.dispatchEvent(new CustomEvent<boolean>(HAPTICS_CHANGE_EVENT, { detail: enabled }));
  }
}

/**
 * React hook for reading and updating the global Haptic Feedback preference.
 */
export function useHapticsPreference() {
  const [hapticsEnabled, setHapticsState] = useState<boolean>(() => isHapticsEnabled());

  useEffect(() => {
    const syncPreference = (e?: Event) => {
      if (e && 'detail' in e) {
        const detail = (e as CustomEvent<boolean>).detail;
        if (typeof detail === 'boolean') {
          setHapticsState(detail);
          return;
        }
      }
      setHapticsState(isHapticsEnabled());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === HAPTICS_STORAGE_KEY) {
        syncPreference();
      }
    };

    window.addEventListener(HAPTICS_CHANGE_EVENT, syncPreference);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(HAPTICS_CHANGE_EVENT, syncPreference);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const updateHapticsEnabled = useCallback((nextEnabled: boolean) => {
    setHapticsEnabled(nextEnabled);
    setHapticsState(nextEnabled);
  }, []);

  const toggleHaptics = useCallback(() => {
    const nextEnabled = !isHapticsEnabled();
    setHapticsEnabled(nextEnabled);
    setHapticsState(nextEnabled);
  }, []);

  return {
    hapticsEnabled,
    setHapticsEnabled: updateHapticsEnabled,
    toggleHaptics,
  };
}

/**
 * Subtle low-intensity vibration feedback for tapping primary buttons
 * and interactive controls, maintaining a refined, premium feel.
 */
export async function triggerLightHaptic(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    if (!isHapticsEnabled()) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8);
      }
    } catch {
      // Ignore fallback errors
    }
  }
}

/**
 * Subtle, restrained vibration feedback for completing tasks in modals
 * (e.g., saving attendance, scheduling sessions, adding payments/students).
 */
export async function triggerSuccessHaptic(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    if (!isHapticsEnabled()) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([10, 35, 10]);
      }
    } catch {
      // Ignore fallback errors
    }
  }
}

/**
 * Ultra-light selection tick for toggles and segmented filters.
 */
export async function triggerSelectionHaptic(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.selectionChanged();
  } catch {
    if (!isHapticsEnabled()) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(4);
      }
    } catch {
      // Ignore fallback errors
    }
  }
}
