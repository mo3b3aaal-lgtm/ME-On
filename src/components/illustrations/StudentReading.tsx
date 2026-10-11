import React from 'react';
import type { IllustrationProps } from './types';

/**
 * StudentReading: Student at a desk writing in a book.
 * Scaled to container (viewBox 0 0 200 160), bottom-anchored, aria-hidden.
 */
export const StudentReading: React.FC<IllustrationProps> = ({ className = '', ...props }) => {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`w-full h-auto max-h-full select-none pointer-events-none ${className}`.trim()}
      {...props}
    >
      {/* Student Body (Behind Desk) */}
      <path d="M68 160V106C68 96 76 90 86 90H114C124 90 132 96 132 106V160" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M94 90L100 102L106 90" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="96" y="82" width="8" height="10" fill="var(--color-skin-medium)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <circle cx="100" cy="68" r="17" fill="var(--color-skin-medium)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <path d="M83 67C83 55 90 50 100 50C110 50 117 55 117 67C117 67 113 60 104 60C95 60 92 65 83 67Z" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="95" cy="71" r="1.5" fill="var(--color-navy)" />
      <circle cx="105" cy="71" r="1.5" fill="var(--color-navy)" />
      <path d="M97 78C99 79.5 101 79.5 103 78" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Desk Surface (Spans across the bottom) */}
      <rect x="24" y="124" width="152" height="36" rx="6" fill="var(--color-mint-soft)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="24" y1="134" x2="176" y2="134" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Open Book on Desk */}
      <path d="M62 144L60 120C74 121 86 117 100 121C114 117 126 121 140 120L138 144C126 142 114 144 100 142C86 144 74 142 62 144Z" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="100" y1="121" x2="100" y2="142" stroke="var(--color-navy)" strokeWidth="2.5" />
      <line x1="68" y1="127" x2="92" y2="127" stroke="var(--color-mint)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="68" y1="133" x2="90" y2="133" stroke="var(--color-mint)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="68" y1="138" x2="86" y2="138" stroke="var(--color-mint)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="108" y1="127" x2="132" y2="127" stroke="var(--color-mint)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="108" y1="133" x2="130" y2="133" stroke="var(--color-mint)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Hands and Pencil */}
      <path d="M124 106L130 124" stroke="var(--color-navy)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="130" cy="124" r="4" fill="var(--color-skin-medium)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <path d="M136 116L125 129" stroke="var(--color-orange)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M136 116L125 129" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="72" cy="125" r="4" fill="var(--color-skin-medium)" stroke="var(--color-navy)" strokeWidth="2.5" />
    </svg>
  );
};

export default StudentReading;
