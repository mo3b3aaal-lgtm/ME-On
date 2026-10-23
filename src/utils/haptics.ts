import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Subtle low-intensity vibration feedback for tapping primary buttons
 * and interactive controls, maintaining a refined, premium feel.
 */
export async function triggerLightHaptic(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
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
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
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
  try {
    await Haptics.selectionChanged();
  } catch {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(4);
      }
    } catch {
      // Ignore fallback errors
    }
  }
}
