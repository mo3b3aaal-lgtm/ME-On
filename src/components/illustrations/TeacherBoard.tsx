import React from 'react';
import type { IllustrationProps } from './types';

/**
 * TeacherBoard: Teacher beside a whiteboard with a simple bar chart.
 * Scaled to container (viewBox 0 0 200 160), bottom-anchored, aria-hidden.
 */
export const TeacherBoard: React.FC<IllustrationProps> = ({ className = '', ...props }) => {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`w-full h-auto max-h-full select-none pointer-events-none ${className}`.trim()}
      {...props}
    >
      {/* Whiteboard Stand & Board */}
      <rect x="18" y="18" width="104" height="82" rx="8" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 30H120" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="24" r="2.5" fill="var(--color-orange)" />
      <circle cx="36" cy="24" r="2.5" fill="var(--color-mint)" />

      {/* Simple Chart on Whiteboard */}
      <line x1="32" y1="84" x2="108" y2="84" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="38" y="62" width="12" height="22" rx="2" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="56" y="48" width="12" height="36" rx="2" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="74" y="38" width="12" height="46" rx="2" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="92" y="54" width="12" height="30" rx="2" fill="var(--color-mint-soft)" stroke="var(--color-navy)" strokeWidth="2.5" />

      {/* Board Stand Legs & Marker Tray */}
      <path d="M36 100V136M104 100V136" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="42" y="98" width="56" height="5" rx="2" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" />

      {/* Teacher Character (Right side, cropped at bottom) */}
      <path d="M128 160V120C128 112 134 106 142 106H166C174 106 180 112 180 120V160" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M148 106L154 118L160 106" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="150" y="98" width="8" height="10" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <circle cx="154" cy="84" r="16" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <path d="M138 82C138 72 144 67 154 67C164 67 170 72 170 82C170 82 168 76 160 76C152 76 148 80 148 80C148 80 144 76 138 82Z" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="149" cy="84" r="1.5" fill="var(--color-navy)" />
      <circle cx="157" cy="84" r="1.5" fill="var(--color-navy)" />
      <path d="M151 90C152.5 92 154.5 92 156 90" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Pointing Arm / Hand */}
      <path d="M136 122L112 92" stroke="var(--color-navy)" strokeWidth="6" strokeLinecap="round" />
      <path d="M136 122L112 92" stroke="var(--color-orange)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="110" cy="90" r="4" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
    </svg>
  );
};

export default TeacherBoard;
