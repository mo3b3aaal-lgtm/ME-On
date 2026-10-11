import React from 'react';
import type { IllustrationProps } from './types';

/**
 * ReportChart: Person pointing up at a dynamic bar chart.
 * Scaled to container (viewBox 0 0 200 160), bottom-anchored, aria-hidden.
 */
export const ReportChart: React.FC<IllustrationProps> = ({ className = '', ...props }) => {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`w-full h-auto max-h-full select-none pointer-events-none ${className}`.trim()}
      {...props}
    >
      {/* Background Chart Board / Panel */}
      <rect x="76" y="18" width="112" height="114" rx="14" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="88" y1="42" x2="176" y2="42" stroke="var(--color-mint-soft)" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="88" y1="68" x2="176" y2="68" stroke="var(--color-mint-soft)" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="88" y1="94" x2="176" y2="94" stroke="var(--color-mint-soft)" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="88" y1="116" x2="176" y2="116" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Bar Chart Bars */}
      <rect x="96" y="82" width="14" height="34" rx="3" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="118" y="60" width="14" height="56" rx="3" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="140" y="36" width="14" height="80" rx="3" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="162" y="50" width="14" height="66" rx="3" fill="var(--color-mint-soft)" stroke="var(--color-navy)" strokeWidth="2.5" />

      {/* Upward Trend Line */}
      <path d="M96 76L118 52L140 28L166 40" stroke="var(--color-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="140" cy="28" r="3.5" fill="var(--color-page)" stroke="var(--color-orange)" strokeWidth="2" />

      {/* Person Character (Left side, pointing, cropped at bottom) */}
      <path d="M20 160V118C20 108 28 102 38 102H62C72 102 80 108 80 118V160" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M44 102L50 114L56 102" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <rect x="46" y="94" width="8" height="10" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <circle cx="50" cy="80" r="16" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <path d="M34 80C34 68 41 63 50 63C59 63 66 68 66 80C66 80 62 72 52 72C43 72 40 77 34 80Z" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="48" cy="80" r="1.5" fill="var(--color-navy)" />
      <circle cx="56" cy="80" r="1.5" fill="var(--color-navy)" />
      <path d="M50 86C52 87.5 55 87.5 57 86" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Arm Pointing up toward the highest bar */}
      <path d="M66 116L102 58" stroke="var(--color-navy)" strokeWidth="7" strokeLinecap="round" />
      <path d="M66 116L102 58" stroke="var(--color-orange)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="103" cy="56" r="4.5" fill="var(--color-skin-light)" stroke="var(--color-navy)" strokeWidth="2.5" />
    </svg>
  );
};

export default ReportChart;
