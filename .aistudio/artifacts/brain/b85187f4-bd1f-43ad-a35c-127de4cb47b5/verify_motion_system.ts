import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ANIMATION_SPEED,
  MOTION_PRESETS,
  MOTION_SPEED_STORAGE_KEY,
  getAnimationSpeed,
  getEffectiveExitDurationMs,
  initMotionPreference,
  isSystemReducedMotion,
  setAnimationSpeed,
} from '/app/applet/src/utils/motion.ts';
import { t } from '/app/applet/src/utils/i18n.ts';

// Minimal DOM + Browser environment mock for Node verification
function createMockEnvironment(initialReducedMotion = false) {
  let reducedMotion = initialReducedMotion;
  const storage = new Map<string, string>();
  const cssVars = new Map<string, string>();
  const dataset: Record<string, string> = {};
  const eventListeners = new Map<string, Set<(ev: any) => void>>();
  const mediaListeners = new Set<() => void>();

  const mockWindow: any = {
    localStorage: {
      getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
      setItem: (k: string, v: string) => storage.set(k, String(v)),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    },
    matchMedia: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      addEventListener: (_type: string, cb: () => void) => mediaListeners.add(cb),
      removeEventListener: (_type: string, cb: () => void) => mediaListeners.delete(cb),
    }),
    addEventListener: (type: string, cb: (ev: any) => void) => {
      if (!eventListeners.has(type)) eventListeners.set(type, new Set());
      eventListeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: (ev: any) => void) => {
      eventListeners.get(type)?.delete(cb);
    },
    dispatchEvent: (ev: any) => {
      eventListeners.get(ev.type)?.forEach((cb) => cb(ev));
      return true;
    },
  };

  const mockDocument: any = {
    documentElement: {
      dataset,
      lang: 'ar',
      dir: 'rtl',
      style: {
        setProperty: (k: string, v: string) => cssVars.set(k, v),
        getPropertyValue: (k: string) => cssVars.get(k) || '',
      },
    },
  };

  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDocument;
  (globalThis as any).localStorage = mockWindow.localStorage;
  if (typeof (globalThis as any).CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEvent<T = any> {
      type: string;
      detail: T;
      constructor(type: string, init?: { detail?: T }) {
        this.type = type;
        this.detail = init?.detail as T;
      }
    };
  }

  return {
    storage,
    cssVars,
    dataset,
    setReducedMotion(next: boolean) {
      reducedMotion = next;
      mediaListeners.forEach((cb) => cb());
    },
  };
}

console.log('--- Verifying Classy Global Motion System ---');

const env = createMockEnvironment(false);

// 1. Default speed must be 'relaxed' (هادئ)
const initialized = initMotionPreference();
assert.equal(DEFAULT_ANIMATION_SPEED, 'relaxed', 'Default speed should be relaxed');
assert.equal(initialized, 'relaxed', 'initMotionPreference should default to relaxed');
assert.equal(getAnimationSpeed(), 'relaxed');
assert.equal(env.dataset.motionSpeed, 'relaxed');
assert.equal(env.cssVars.get('--motion-enter-duration'), '450ms');
assert.equal(env.cssVars.get('--motion-exit-duration'), '310ms');
assert.equal(env.cssVars.get('--motion-rise-detail'), '26px');
assert.equal(env.cssVars.get('--nav-transition-duration'), '360ms');
assert.equal(getEffectiveExitDurationMs(), 310);

// 2. Preset duration ranges match requirements
assert.ok(
  MOTION_PRESETS.fast.enterDurationMs >= 180 && MOTION_PRESETS.fast.enterDurationMs <= 230,
  `Fast preset (${MOTION_PRESETS.fast.enterDurationMs}ms) must be within 180-230ms`
);
assert.ok(
  MOTION_PRESETS.balanced.enterDurationMs >= 280 && MOTION_PRESETS.balanced.enterDurationMs <= 350,
  `Balanced preset (${MOTION_PRESETS.balanced.enterDurationMs}ms) must be within 280-350ms`
);
assert.ok(
  MOTION_PRESETS.relaxed.enterDurationMs >= 400 && MOTION_PRESETS.relaxed.enterDurationMs <= 500,
  `Relaxed preset (${MOTION_PRESETS.relaxed.enterDurationMs}ms) must be within 400-500ms`
);

// 3. Updating speed persists to localStorage and updates CSS vars immediately
let lastDispatchedSpeed: string | null = null;
(globalThis as any).window.addEventListener('classy-motion-speed-change', (e: any) => {
  lastDispatchedSpeed = e.detail;
});

setAnimationSpeed('fast');
assert.equal(env.storage.get(MOTION_SPEED_STORAGE_KEY), 'fast');
assert.equal(getAnimationSpeed(), 'fast');
assert.equal(lastDispatchedSpeed, 'fast');
assert.equal(env.cssVars.get('--motion-enter-duration'), '205ms');
assert.equal(env.cssVars.get('--motion-exit-duration'), '165ms');
assert.equal(getEffectiveExitDurationMs(), 165);

setAnimationSpeed('balanced');
assert.equal(env.storage.get(MOTION_SPEED_STORAGE_KEY), 'balanced');
assert.equal(getAnimationSpeed(), 'balanced');
assert.equal(lastDispatchedSpeed, 'balanced');
assert.equal(env.cssVars.get('--motion-enter-duration'), '320ms');
assert.equal(env.cssVars.get('--motion-exit-duration'), '235ms');
assert.equal(getEffectiveExitDurationMs(), 235);

// 4. OS prefers-reduced-motion is strictly respected without wiping user preference
env.setReducedMotion(true);
assert.equal(isSystemReducedMotion(), true);
assert.equal(getAnimationSpeed(), 'balanced', 'Saved user speed preference remains stored');
assert.equal(getEffectiveExitDurationMs(), 0, 'Exit unmount delay collapses to 0ms under reduced motion');
assert.equal(env.dataset.reducedMotion, 'true');
assert.equal(env.cssVars.get('--motion-enter-duration'), '0.01ms');
assert.equal(env.cssVars.get('--motion-rise-detail'), '0px');

env.setReducedMotion(false);
assert.equal(isSystemReducedMotion(), false);
assert.equal(env.cssVars.get('--motion-enter-duration'), '320ms');
assert.equal(getEffectiveExitDurationMs(), 235);

// 5. Verify i18n translations across ar, en-GB, en-US
assert.equal(t('animationSpeed', 'ar'), 'سرعة الأنيميشن');
assert.equal(t('animationSpeedFast', 'ar'), 'سريع');
assert.equal(t('animationSpeedBalanced', 'ar'), 'متوسط');
assert.equal(t('animationSpeedRelaxed', 'ar'), 'هادئ');

assert.equal(t('animationSpeed', 'en-GB'), 'Animation Speed');
assert.equal(t('animationSpeedFast', 'en-GB'), 'Fast');
assert.equal(t('animationSpeedBalanced', 'en-GB'), 'Balanced');
assert.equal(t('animationSpeedRelaxed', 'en-GB'), 'Relaxed');

assert.equal(t('animationSpeed', 'en-US'), 'Animation Speed');
assert.equal(t('animationSpeedSavedToast', { speed: 'Relaxed' }, 'en-US'), 'Animation speed set to Relaxed.');

// 6. Verify CSS bottom-to-top keyframes in src/index.css
const cssContent = fs.readFileSync(path.resolve('/app/applet/src/index.css'), 'utf8');
assert.ok(cssContent.includes('@keyframes detail-rise-up'), 'detail-rise-up keyframe must exist');
assert.ok(cssContent.includes('@keyframes detail-settle-down'), 'detail-settle-down keyframe must exist');
assert.ok(
  cssContent.includes('translate3d(0, var(--motion-rise-detail, 26px), 0)'),
  'detail-rise-up must translate vertically from bottom to top'
);

console.log('ALL MOTION SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY.');
