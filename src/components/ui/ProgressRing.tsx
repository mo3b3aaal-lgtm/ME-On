import React, { useEffect, useRef, useState } from 'react';

/**
 * Guard any numeric input to a valid 0..100 percentage, handling NaN, Infinity, or division by zero.
 */
export function sanitizeProgressValue(value: number | undefined | null): number {
  if (value === undefined || value === null || typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

/**
 * Counts a number up from 0 (on mount) or previous value to `target` in `duration` ms (ease-out).
 * Respects prefers-reduced-motion.
 */
export function useCountUp(target: number, duration = 900): number {
  const safeTarget = sanitizeProgressValue(target);
  const [current, setCurrent] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return Math.round(safeTarget);
    }
    return 0;
  });

  const previousRef = useRef<number>(0);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || duration <= 0) {
      previousRef.current = safeTarget;
      setCurrent(Math.round(safeTarget));
      return;
    }

    const startValue = previousRef.current;
    const delta = safeTarget - startValue;

    if (delta === 0) {
      setCurrent(Math.round(safeTarget));
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, Math.max(0, elapsed / duration));
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const nextVal = startValue + delta * eased;
      setCurrent(Math.round(nextVal));

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        previousRef.current = safeTarget;
        setCurrent(Math.round(safeTarget));
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      previousRef.current = safeTarget;
    };
  }, [safeTarget, duration]);

  return current;
}

export interface ProgressRingProps {
  /** Progress percentage from 0 to 100 (division by zero / NaN guarded to 0) */
  value: number;
  /** Diameter in px (default 88) */
  size?: number;
  /** Stroke width in px (default 10) */
  stroke?: number;
  /** Track color token or CSS variable. Defaults to navy-soft when variant="navy" or mint-soft on light cards */
  trackColor?: string;
  /** Arc color token or CSS variable. Defaults to var(--color-orange) */
  arcColor?: string;
  /** Card surface context: 'navy' uses var(--color-navy-soft) track, 'light' uses var(--color-mint-soft) track */
  variant?: 'navy' | 'light';
  /** Optional custom center label (overrides the animated "65%" label) */
  label?: React.ReactNode;
  /** Optional children rendered inside the ring center */
  children?: React.ReactNode;
  className?: string;
}

function resolveColorToken(token: string | undefined, fallback: string): string {
  if (!token) return fallback;
  if (token === 'navy-soft') return 'var(--color-navy-soft)';
  if (token === 'mint-soft') return 'var(--color-mint-soft)';
  if (token === 'orange') return 'var(--color-orange)';
  if (token === 'navy') return 'var(--color-navy)';
  if (token === 'teal') return 'var(--color-teal)';
  if (token === 'coral') return 'var(--color-coral)';
  if (token === 'mint') return 'var(--color-mint)';
  return token;
}

/**
 * ProgressRing:
 * - Props: value 0-100, size (default 88), stroke (10), track color, arc color, children/label.
 * - Orange arc with round caps starting at the top, track = navy-soft on navy cards or mint-soft on light cards;
 * - Center label (e.g. "65%") 20px/700.
 * - Animates the arc from 0 to value in 900ms ease-out on mount and when value changes; counts the number up in sync.
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 88,
  stroke = 10,
  trackColor,
  arcColor,
  variant = 'light',
  label,
  children,
  className = '',
}) => {
  const safeValue = sanitizeProgressValue(value);
  const animatedCount = useCountUp(safeValue, 900);

  const [animatedArcValue, setAnimatedArcValue] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return safeValue;
    }
    return 0;
  });

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setAnimatedArcValue(safeValue);
      return;
    }

    const rafId = requestAnimationFrame(() => {
      setAnimatedArcValue(safeValue);
    });
    return () => cancelAnimationFrame(rafId);
  }, [safeValue]);

  const safeSize = Math.max(24, size);
  const safeStroke = Math.max(2, Math.min(safeSize / 2 - 2, stroke));
  const radius = (safeSize - safeStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (animatedArcValue / 100) * circumference;

  const defaultTrack =
    variant === 'navy' ? 'var(--color-navy-soft)' : 'var(--color-mint-soft)';
  const resolvedTrack = resolveColorToken(trackColor, defaultTrack);
  const resolvedArc = resolveColorToken(arcColor, 'var(--color-orange)');

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`.trim()}
      style={{ width: safeSize, height: safeSize }}
      role="progressbar"
      aria-valuenow={Math.round(safeValue)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={safeSize}
        height={safeSize}
        viewBox={`0 0 ${safeSize} ${safeSize}`}
        className="-rotate-90 transform"
      >
        {/* Background Track */}
        <circle
          cx={safeSize / 2}
          cy={safeSize / 2}
          r={radius}
          fill="none"
          stroke={resolvedTrack}
          strokeWidth={safeStroke}
        />
        {/* Animated Progress Arc */}
        <circle
          cx={safeSize / 2}
          cy={safeSize / 2}
          r={radius}
          fill="none"
          stroke={resolvedArc}
          strokeWidth={safeStroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>

      {/* Center Label (20px/700) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {children !== undefined ? (
          children
        ) : label !== undefined ? (
          <span className="text-[20px] font-bold leading-none">{label}</span>
        ) : (
          <span className="text-[20px] font-bold leading-none">
            {animatedCount}%
          </span>
        )}
      </div>
    </div>
  );
};

export default ProgressRing;
