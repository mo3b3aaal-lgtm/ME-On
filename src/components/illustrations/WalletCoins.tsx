import React from 'react';
import type { IllustrationProps } from './types';

/**
 * WalletCoins: Wallet with coins and a small receipt.
 * Scaled to container (viewBox 0 0 200 160), bottom-anchored, aria-hidden.
 */
export const WalletCoins: React.FC<IllustrationProps> = ({ className = '', ...props }) => {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`w-full h-auto max-h-full select-none pointer-events-none ${className}`.trim()}
      {...props}
    >
      {/* 1. White Receipt Peeking from Behind Wallet */}
      <g transform="rotate(-8 60 70)">
        <rect x="38" y="26" width="44" height="64" rx="4" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="44" y="34" width="32" height="6" rx="2" fill="var(--color-mint)" />
        <line x1="44" y1="46" x2="74" y2="46" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="44" y1="52" x2="68" y2="52" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="44" y1="58" x2="72" y2="58" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M60 70L65 75L74 65" stroke="var(--color-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* 2. Floating Gold / Orange Coins */}
      <circle cx="44" cy="96" r="14" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <circle cx="44" cy="96" r="9" fill="none" stroke="var(--color-page)" strokeWidth="2" strokeDasharray="3 3" />
      <text x="44" y="100" textAnchor="middle" fill="var(--color-navy)" fontSize="11" fontWeight="bold" fontFamily="sans-serif">$</text>

      <circle cx="148" cy="48" r="13" fill="var(--color-mint)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <circle cx="148" cy="48" r="8" fill="none" stroke="var(--color-navy)" strokeWidth="2" />

      <circle cx="162" cy="78" r="15" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <circle cx="162" cy="78" r="10" fill="none" stroke="var(--color-page)" strokeWidth="2" strokeDasharray="3 3" />
      <text x="162" y="82" textAnchor="middle" fill="var(--color-navy)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">$</text>

      {/* 3. Main Leather Wallet (Bottom-Anchored) */}
      <rect x="36" y="78" width="128" height="82" rx="16" fill="var(--color-navy)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M38 98C70 94 130 94 162 98" stroke="var(--color-page)" strokeWidth="2" strokeLinecap="round" />
      <rect x="36" y="96" width="128" height="64" rx="16" fill="var(--color-mint-soft)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Wallet Flap with Clasp */}
      <path d="M120 114H164V142H120C114 142 110 136 110 128C110 120 114 114 120 114Z" fill="var(--color-orange)" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="126" cy="128" r="4.5" fill="var(--color-page)" stroke="var(--color-navy)" strokeWidth="2.5" />
      <line x1="46" y1="148" x2="154" y2="148" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
    </svg>
  );
};

export default WalletCoins;
