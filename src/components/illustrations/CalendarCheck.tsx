import React from 'react';
import type { IllustrationProps } from './types';

/**
 * CalendarCheck: Calendar with a vibrant orange checkmark.
 * Scaled to container (viewBox 0 0 200 160), bottom-anchored, aria-hidden.
 */
export const CalendarCheck: React.FC<IllustrationProps> = ({ className = '', ...props }) => {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`w-full h-auto max-h-full select-none pointer-events-none ${className}`.trim()}
      {...props}
    >
      {/* Background Little Confetti / Sparkles */}
      <circle cx="28" cy="38" r="3" fill="var(--color-orange)" />
      <circle cx="174" cy="46" r="3.5" fill="var(--color-mint)" />
      <path d="M166 26L168 32L174 34L168 36L166 42L164 36L158 34L164 32Z" fill="var(--color-navy)" />
      <path d="M34 94L35.5 98L40 99.5L35.5 101L34 105L32.5 101L28 99.5L32.5 98Z" fill="var(--color-orange)" />

      {/* Calendar Base Block (Bottom-Anchored) */}
      <rect
        x="36"
        y="30"
        width="128"
        height="130"
        rx="18"
        fill="var(--color-page)"
        stroke="var(--color-navy)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Top Header Strip (Navy) */}
      <path
        d="M36 48C36 38 44 30 54 30H146C156 30 164 38 164 48V60H36V48Z"
        fill="var(--color-navy)"
        stroke="var(--color-navy)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Binder Rings */}
      <rect x="58" y="22" width="8" height="16" rx="4" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="96" y="22" width="8" height="16" rx="4" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="134" y="22" width="8" height="16" rx="4" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" />

      {/* Month Header Text Placeholder Lines */}
      <line x1="78" y1="46" x2="122" y2="46" stroke="var(--color-page)" strokeWidth="3" strokeLinecap="round" />

      {/* Grid of Days (Subtle mint-soft squares) */}
      {/* Row 1 */}
      <rect x="52" y="74" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="76" y="74" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="100" y="74" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="124" y="74" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />

      {/* Row 2 */}
      <rect x="52" y="96" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="76" y="96" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="100" y="96" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="124" y="96" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />

      {/* Row 3 */}
      <rect x="52" y="118" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="76" y="118" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="100" y="118" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />
      <rect x="124" y="118" width="16" height="14" rx="3" fill="var(--color-mint-soft)" />

      {/* Big Orange Checkmark Shield / Circle Emblem */}
      <circle
        cx="100"
        cy="108"
        r="28"
        fill="var(--color-page)"
        stroke="var(--color-navy)"
        strokeWidth="2.5"
      />
      <circle
        cx="100"
        cy="108"
        r="22"
        fill="var(--color-mint)"
      />

      {/* Bold Orange Checkmark */}
      <path
        d="M89 108L97 116L113 98"
        stroke="var(--color-navy)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M89 108L97 116L113 98"
        stroke="var(--color-orange)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default CalendarCheck;
