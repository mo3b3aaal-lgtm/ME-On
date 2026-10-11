import React from 'react';
import type { IllustrationProps } from './types';

/**
 * EmptyBox: Open cardboard box with a magnifying glass for empty states.
 * Scaled to container (viewBox 0 0 200 160), bottom-anchored, aria-hidden.
 */
export const EmptyBox: React.FC<IllustrationProps> = ({ className = '', ...props }) => {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`w-full h-auto max-h-full select-none pointer-events-none ${className}`.trim()}
      {...props}
    >
      {/* Playful Floating Sparkles & Search Dots */}
      <circle cx="42" cy="42" r="3" fill="var(--color-orange)" />
      <circle cx="162" cy="48" r="3.5" fill="var(--color-mint)" />
      <path d="M52 26L53.5 30L58 31.5L53.5 33L52 37L50.5 33L46 31.5L50.5 30Z" fill="var(--color-navy)" />
      <path d="M152 28L153.5 32L158 33.5L153.5 35L152 39L150.5 35L146 33.5L150.5 32Z" fill="var(--color-orange)" />

      {/* Box Back Flap & Depth */}
      <path d="M68 76L80 50H120L132 76" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="46,88 154,88 138,136 62,136" fill="var(--color-mint-soft)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Left and Right Outer Flaps */}
      <path d="M46 88L24 72L50 64L68 76" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M154 88L176 72L150 64L132 76" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Box Front Face & Front Flap */}
      <path d="M46 88L62 136H138L154 88H46Z" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M62 88L74 116H126L138 88" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="92" y="96" width="16" height="38" rx="2" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" />

      {/* Big Magnifying Glass (Angled, Floating above box) */}
      <g transform="rotate(-15 106 68)">
        <rect x="102" y="74" width="8" height="32" rx="4" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <rect x="101" y="70" width="10" height="6" rx="2" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <circle cx="106" cy="48" r="24" fill="var(--color-mint-soft)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <path d="M92 40C94 34 102 30 110 32" stroke="var(--color-page)" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="118" cy="38" r="2" fill="var(--color-page)" />
      </g>
    </svg>
  );
};

export default EmptyBox;
