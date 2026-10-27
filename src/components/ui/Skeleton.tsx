import React, { useState, useEffect } from 'react';

export type SkeletonTone = 'default' | 'on-mint' | 'on-navy' | 'subtle';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'rounded' | 'text';
  tone?: SkeletonTone;
  width?: string | number;
  height?: string | number;
}

/**
 * Prevents sub-threshold loading flashes (<90ms) while clearing immediately (0ms)
 * the instant real data arrives.
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 90): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setVisible(false);
      return;
    }
    if (delayMs <= 0) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isLoading, delayMs]);

  return isLoading ? visible : false;
}

/**
 * Suspense fallback wrapper that waits a brief threshold before painting skeletons,
 * preventing brief single-frame flashes on fast chunk resolutions.
 */
export const DelayedFallback: React.FC<{
  delayMs?: number;
  children: React.ReactNode;
}> = ({ delayMs = 90, children }) => {
  const [ready, setReady] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = window.setTimeout(() => {
      setReady(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  if (!ready) return null;
  return <>{children}</>;
};

/**
 * Skeleton: Placeholder loading primitive built on Classy's Harbor Mint tokens.
 * Respects prefers-reduced-motion and stops animation immediately upon unmount.
 */
export const Skeleton: React.FC<SkeletonProps> = React.memo(
  ({
    className = '',
    variant = 'rounded',
    tone = 'default',
    width,
    height,
    style,
    ...props
  }) => {
    const variantClasses = {
      rectangular: 'rounded-none',
      circular: 'rounded-full',
      rounded: 'rounded-[14px]',
      text: 'rounded-[8px] h-3.5',
    }[variant];

    const toneClasses = {
      default: 'bg-mint-soft skeleton-shimmer',
      'on-mint': 'skeleton-shimmer-on-mint',
      'on-navy': 'skeleton-shimmer-on-navy',
      subtle: 'skeleton-static',
    }[tone];

    return (
      <div
        aria-hidden="true"
        className={`relative overflow-hidden select-none pointer-events-none ${variantClasses} ${toneClasses} ${className}`.trim()}
        style={
          width !== undefined || height !== undefined || style
            ? {
                width,
                height,
                ...style,
              }
            : undefined
        }
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;
