import React from 'react';
import type { IllustrationProps } from './types';

/**
 * StudentsTrio: Three diverse students together.
 * Scaled to container (viewBox 0 0 200 160), bottom-anchored, aria-hidden.
 */
export const StudentsTrio: React.FC<IllustrationProps> = ({ className = '', ...props }) => {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`w-full h-auto max-h-full select-none pointer-events-none ${className}`.trim()}
      {...props}
    >
      {/* 1. LEFT STUDENT (Orange Shirt, Light Skin) */}
      <g>
        <path d="M18 160V126C18 116 26 110 36 110H64C74 110 82 116 82 126V160" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M44 110L50 120L56 110" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <rect x="46" y="102" width="8" height="10" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <circle cx="50" cy="90" r="15" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <path d="M35 90C35 77 41 73 50 73C59 73 65 77 65 90C65 90 61 82 52 82C43 82 40 88 35 90Z" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="45" cy="90" r="1.5" fill="var(--color-navy)" />
        <circle cx="53" cy="90" r="1.5" fill="var(--color-navy)" />
        <path d="M47 95C48.5 96.5 50.5 96.5 52 95" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* 2. RIGHT STUDENT (Mint Shirt, Dark Skin) */}
      <g>
        <path d="M118 160V126C118 116 126 110 136 110H164C174 110 182 116 182 126V160" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M144 110L150 120L156 110" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <rect x="146" y="102" width="8" height="10" fill="var(--color-skin-dark)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <circle cx="150" cy="90" r="15" fill="var(--color-skin-dark)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <path d="M135 84C133 74 140 70 150 70C160 70 167 74 165 84C165 84 158 78 150 78C142 78 136 84 135 84Z" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="145" cy="90" r="1.5" fill="var(--color-page)" />
        <circle cx="153" cy="90" r="1.5" fill="var(--color-page)" />
        <path d="M147 95C148.5 96.5 150.5 96.5 152 95" stroke="var(--color-page)" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* 3. CENTER STUDENT (Front, Navy Shirt, Medium Skin) */}
      <g>
        <path d="M66 160V116C66 104 76 98 88 98H112C124 98 134 104 134 116V160" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="110" y="126" width="12" height="14" rx="2" fill="var(--color-mint-soft)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <rect x="96" y="90" width="8" height="10" fill="var(--color-skin-medium)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <circle cx="100" cy="76" r="16" fill="var(--color-skin-medium)" stroke="var(--color-navy)" strokeWidth="2.5" />
        <path d="M84 74C84 61 91 56 100 56C109 56 116 61 116 74C116 74 111 67 102 67C94 67 91 72 84 74Z" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="95" cy="76" r="1.5" fill="var(--color-navy)" />
        <circle cx="105" cy="76" r="1.5" fill="var(--color-navy)" />
        <path d="M97 82C98.5 84 101.5 84 103 82" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
};

export default StudentsTrio;
