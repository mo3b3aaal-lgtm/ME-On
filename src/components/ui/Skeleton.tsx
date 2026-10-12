import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'rounded' | 'text';
  width?: string | number;
  height?: string | number;
}

/**
 * Skeleton: Placeholder loading in mint-soft with a soft shimmer.
 * Respects prefers-reduced-motion.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rounded',
  width,
  height,
  style,
  ...props
}) => {
  const variantClasses = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-[16px]',
    text: 'rounded-[8px] h-4 my-1',
  }[variant];

  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-mint-soft skeleton-shimmer select-none pointer-events-none ${variantClasses} ${className}`.trim()}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};

export default Skeleton;
