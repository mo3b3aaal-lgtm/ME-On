import React from 'react';
import { AchievementFrame } from '../types';

interface FrameSVGProps {
  frame: AchievementFrame;
  className?: string;
}

// ----------------------------------------------------
// 1. SILVER — فضي (Polished Silver Metal & Elegant Laurels)
// ----------------------------------------------------
const SilverFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="slv_metal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="25%" stopColor="#E2E8F0" />
        <stop offset="50%" stopColor="#94A3B8" />
        <stop offset="75%" stopColor="#CBD5E1" />
        <stop offset="100%" stopColor="#64748B" />
      </linearGradient>
      <linearGradient id="slv_highlight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
        <stop offset="50%" stopColor="#E2E8F0" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id="slv_rim" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="50%" stopColor="#CBD5E1" />
        <stop offset="100%" stopColor="#F8FAFC" />
      </linearGradient>
      <filter id="slv_shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#1E293B" floodOpacity="0.45" />
      </filter>
    </defs>

    {/* Symmetrical Left Silver Laurel Wreath */}
    <g filter="url(#slv_shadow)">
      {/* Leaves ascending left */}
      <path d="M 36 94 C 20 86 16 68 24 52 C 30 68 42 78 54 84 Z" fill="url(#slv_metal)" stroke="#475569" strokeWidth="1.2" />
      <path d="M 38 88 C 24 82 22 70 28 58" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
      
      <path d="M 31 114 C 16 110 12 94 20 78 C 28 92 40 102 50 106 Z" fill="url(#slv_metal)" stroke="#475569" strokeWidth="1.2" />
      <path d="M 33 108 C 22 104 20 94 26 84" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />

      <path d="M 36 134 C 22 136 18 152 26 166 C 32 152 44 142 54 136 Z" fill="url(#slv_metal)" stroke="#475569" strokeWidth="1.2" />
      <path d="M 38 140 C 26 142 24 152 30 160" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
    </g>

    {/* Symmetrical Right Silver Laurel Wreath */}
    <g filter="url(#slv_shadow)">
      {/* Leaves ascending right */}
      <path d="M 164 94 C 180 86 184 68 176 52 C 170 68 158 78 146 84 Z" fill="url(#slv_metal)" stroke="#475569" strokeWidth="1.2" />
      <path d="M 162 88 C 176 82 178 70 172 58" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />

      <path d="M 169 114 C 184 110 188 94 180 78 C 172 92 160 102 150 106 Z" fill="url(#slv_metal)" stroke="#475569" strokeWidth="1.2" />
      <path d="M 167 108 C 178 104 180 94 174 84" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />

      <path d="M 164 134 C 178 136 182 152 174 166 C 168 152 156 142 146 136 Z" fill="url(#slv_metal)" stroke="#475569" strokeWidth="1.2" />
      <path d="M 162 140 C 174 142 176 152 170 160" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
    </g>

    {/* Outer Silver Ring Bevel */}
    <circle cx="100" cy="100" r="77" stroke="url(#slv_metal)" strokeWidth="6" filter="url(#slv_shadow)" />
    <circle cx="100" cy="100" r="80" stroke="#334155" strokeWidth="1" />
    <circle cx="100" cy="100" r="74" stroke="#334155" strokeWidth="1" />

    {/* Inner Polished Ring Accent */}
    <circle cx="100" cy="100" r="67" stroke="url(#slv_rim)" strokeWidth="3" />
    <circle cx="100" cy="100" r="65.5" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.8" />

    {/* Precision Steel Rivets at Cardinal Positions */}
    <circle cx="48" cy="72" r="2.2" fill="#FFFFFF" stroke="#334155" strokeWidth="1" />
    <circle cx="152" cy="72" r="2.2" fill="#FFFFFF" stroke="#334155" strokeWidth="1" />
    <circle cx="48" cy="128" r="2.2" fill="#FFFFFF" stroke="#334155" strokeWidth="1" />
    <circle cx="152" cy="128" r="2.2" fill="#FFFFFF" stroke="#334155" strokeWidth="1" />

    {/* Top Silver Heraldic Crest */}
    <g filter="url(#slv_shadow)">
      {/* Arched mount */}
      <path d="M 72 36 Q 100 24 128 36 L 122 46 Q 100 36 78 46 Z" fill="url(#slv_metal)" stroke="#334155" strokeWidth="1.2" />
      {/* Center Diamond Jewel Badge */}
      <polygon points="100,16 112,32 100,44 88,32" fill="url(#slv_metal)" stroke="#334155" strokeWidth="1.5" />
      <polygon points="100,18 110,32 100,32" fill="#FFFFFF" fillOpacity="0.9" />
      <polygon points="100,32 110,32 100,42" fill="#94A3B8" />
      <polygon points="88,32 100,18 100,32" fill="#E2E8F0" />
      <polygon points="88,32 100,32 100,42" fill="#64748B" />
      {/* Inner starlet */}
      <circle cx="100" cy="32" r="2" fill="#FFFFFF" />
    </g>

    {/* Bottom Silver Ribbon Scroll */}
    <g filter="url(#slv_shadow)">
      <path d="M 68 164 Q 100 156 132 164 L 138 178 Q 100 172 62 178 Z" fill="url(#slv_metal)" stroke="#334155" strokeWidth="1.2" />
      <polygon points="100,164 105,173 115,173 107,178 110,187 100,181 90,187 93,178 85,173 95,173" fill="#FFFFFF" stroke="#475569" strokeWidth="0.8" />
      <circle cx="100" cy="173" r="2" fill="#64748B" />
    </g>
  </svg>
);

// ----------------------------------------------------
// 2. GOLD — ذهبي (Rich Metallic Gold & Royal Laurels)
// ----------------------------------------------------
const GoldFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="gld_base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="20%" stopColor="#FDE68A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="80%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
      <linearGradient id="gld_light" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="45%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="gld_ruby" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FCA5A5" />
        <stop offset="40%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
      <filter id="gld_shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#78350F" floodOpacity="0.55" />
      </filter>
    </defs>

    {/* Symmetrical Left Rich Gold Laurels */}
    <g filter="url(#gld_shadow)">
      <path d="M 34 82 C 16 72 14 52 24 36 C 30 52 44 64 56 70 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.3" />
      <path d="M 36 76 C 24 68 22 56 28 46" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 28 104 C 12 98 8 80 18 64 C 26 80 40 90 50 94 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.3" />
      <path d="M 30 98 C 20 92 18 80 24 72" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 32 126 C 16 128 12 146 22 162 C 28 146 42 136 52 130 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.3" />
      <path d="M 34 132 C 24 136 22 146 28 154" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" />
    </g>

    {/* Symmetrical Right Rich Gold Laurels */}
    <g filter="url(#gld_shadow)">
      <path d="M 166 82 C 184 72 186 52 176 36 C 170 52 156 64 144 70 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.3" />
      <path d="M 164 76 C 176 68 178 56 172 46" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 172 104 C 188 98 192 80 182 64 C 174 80 160 90 150 94 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.3" />
      <path d="M 170 98 C 180 92 182 80 176 72" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 168 126 C 184 128 188 146 178 162 C 172 146 158 136 148 130 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.3" />
      <path d="M 166 132 C 176 136 178 146 172 154" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" />
    </g>

    {/* Heavy 24K Gold Outer Beveled Ring */}
    <circle cx="100" cy="100" r="77" stroke="url(#gld_base)" strokeWidth="8" filter="url(#gld_shadow)" />
    <circle cx="100" cy="100" r="81" stroke="#78350F" strokeWidth="1.3" />
    <circle cx="100" cy="100" r="73" stroke="#78350F" strokeWidth="1.3" />

    {/* Bright Golden Ring Inset */}
    <circle cx="100" cy="100" r="67" stroke="url(#gld_light)" strokeWidth="3" />
    <circle cx="100" cy="100" r="65.5" stroke="#FFFBEB" strokeWidth="1" strokeOpacity="0.9" />

    {/* Golden Studs at Ring Nodes */}
    <circle cx="46" cy="66" r="2.5" fill="#FFFBEB" stroke="#78350F" strokeWidth="1" />
    <circle cx="154" cy="66" r="2.5" fill="#FFFBEB" stroke="#78350F" strokeWidth="1" />
    <circle cx="46" cy="134" r="2.5" fill="#FFFBEB" stroke="#78350F" strokeWidth="1" />
    <circle cx="154" cy="134" r="2.5" fill="#FFFBEB" stroke="#78350F" strokeWidth="1" />

    {/* Top Royal Gold Achievement Crown */}
    <g filter="url(#gld_shadow)">
      {/* Crown base plinth */}
      <path d="M 66 38 L 134 38 L 126 48 L 74 48 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.2" />
      {/* Crown peaks */}
      <path
        d="M 68 38 L 62 18 L 82 28 L 100 12 L 118 28 L 138 18 L 132 38 Z"
        fill="url(#gld_light)"
        stroke="#78350F"
        strokeWidth="1.5"
      />
      {/* Crown center jewel */}
      <circle cx="100" cy="28" r="4.5" fill="url(#gld_ruby)" stroke="#78350F" strokeWidth="1.2" />
      <circle cx="98.5" cy="26.5" r="1.5" fill="#FFFFFF" />
      {/* Side pearls */}
      <circle cx="62" cy="18" r="3" fill="#FFFBEB" stroke="#78350F" strokeWidth="1" />
      <circle cx="138" cy="18" r="3" fill="#FFFBEB" stroke="#78350F" strokeWidth="1" />
      <circle cx="100" cy="12" r="3.5" fill="#FFFBEB" stroke="#78350F" strokeWidth="1" />
    </g>

    {/* Bottom Golden Champion Shield & Flourish */}
    <g filter="url(#gld_shadow)">
      <path d="M 78 162 L 100 190 L 122 162 L 100 156 Z" fill="url(#gld_base)" stroke="#78350F" strokeWidth="1.5" />
      <polygon points="100,166 104,175 114,175 106,181 109,190 100,184 91,190 94,181 86,175 96,175" fill="#FFFBEB" stroke="#78350F" strokeWidth="0.8" />
    </g>
  </svg>
);

// ----------------------------------------------------
// 3. PLATINUM — بلاتينيوم (Luminous Icy Facets & Crystal Edges)
// ----------------------------------------------------
const PlatinumFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="plt_metal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="30%" stopColor="#E0F2FE" />
        <stop offset="60%" stopColor="#7DD3FC" />
        <stop offset="85%" stopColor="#0284C7" />
        <stop offset="100%" stopColor="#0C4A6E" />
      </linearGradient>
      <linearGradient id="plt_gem" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="40%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
      <linearGradient id="plt_frost" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="50%" stopColor="#BAE6FD" />
        <stop offset="100%" stopColor="#38BDF8" />
      </linearGradient>
      <filter id="plt_shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#0C4A6E" floodOpacity="0.55" />
      </filter>
    </defs>

    {/* Angular Crystal Blades Left */}
    <g filter="url(#plt_shadow)">
      <polygon points="46,44 18,34 34,60 52,54" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
      <polygon points="46,44 18,34 36,46" fill="#FFFFFF" fillOpacity="0.8" />

      <polygon points="34,76 10,88 32,102 46,92" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
      <polygon points="34,76 10,88 28,84" fill="#FFFFFF" fillOpacity="0.7" />

      <polygon points="36,124 12,136 34,152 48,138" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
      <polygon points="48,158 22,176 46,168 56,152" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
    </g>

    {/* Angular Crystal Blades Right */}
    <g filter="url(#plt_shadow)">
      <polygon points="154,44 182,34 166,60 148,54" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
      <polygon points="154,44 182,34 164,46" fill="#FFFFFF" fillOpacity="0.8" />

      <polygon points="166,76 190,88 168,102 154,92" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
      <polygon points="166,76 190,88 172,84" fill="#FFFFFF" fillOpacity="0.7" />

      <polygon points="164,124 188,136 166,152 152,138" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
      <polygon points="152,158 178,176 154,168 144,152" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.2" />
    </g>

    {/* Faceted Heavy Platinum Ring */}
    <circle cx="100" cy="100" r="77" stroke="url(#plt_metal)" strokeWidth="8" filter="url(#plt_shadow)" />
    <circle cx="100" cy="100" r="81" stroke="#0C4A6E" strokeWidth="1.3" />
    <circle cx="100" cy="100" r="73" stroke="#0C4A6E" strokeWidth="1.3" />

    {/* Inner Luminous Cyan-White Ring */}
    <circle cx="100" cy="100" r="67" stroke="url(#plt_gem)" strokeWidth="3" />
    <circle cx="100" cy="100" r="65.5" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.9" />

    {/* Top Crystalline Crown Tiara */}
    <g filter="url(#plt_shadow)">
      <path d="M 70 38 L 100 12 L 130 38 L 118 46 L 100 32 L 82 46 Z" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.5" />
      <polygon points="100,12 110,28 100,34 90,28" fill="url(#plt_gem)" stroke="#0C4A6E" strokeWidth="1" />
      <polygon points="100,12 108,28 100,28" fill="#FFFFFF" />
      <circle cx="100" cy="24" r="2.5" fill="#FFFFFF" />
      {/* Side crystal spurs */}
      <polygon points="80,26 66,34 82,38" fill="#E0F2FE" stroke="#0C4A6E" strokeWidth="1" />
      <polygon points="120,26 134,34 118,38" fill="#E0F2FE" stroke="#0C4A6E" strokeWidth="1" />
    </g>

    {/* Bottom Diamond Chevron Guard */}
    <g filter="url(#plt_shadow)">
      <path d="M 74 164 L 100 188 L 126 164 L 114 158 L 100 172 L 86 158 Z" fill="url(#plt_metal)" stroke="#0C4A6E" strokeWidth="1.5" />
      <polygon points="100,172 108,182 100,188 92,182" fill="url(#plt_gem)" stroke="#0C4A6E" strokeWidth="1" />
      <circle cx="100" cy="180" r="1.5" fill="#FFFFFF" />
    </g>
  </svg>
);

// ----------------------------------------------------
// 4. VIP — VIP (Dark Obsidian & Imperial Gold Tracery)
// ----------------------------------------------------
const VipFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="vip_obsidian" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E293B" />
        <stop offset="35%" stopColor="#0F172A" />
        <stop offset="70%" stopColor="#020617" />
        <stop offset="100%" stopColor="#000000" />
      </linearGradient>
      <linearGradient id="vip_gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="40%" stopColor="#F59E0B" />
        <stop offset="80%" stopColor="#B45309" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
      <linearGradient id="vip_amber" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="30%" stopColor="#F97316" />
        <stop offset="80%" stopColor="#C2410C" />
        <stop offset="100%" stopColor="#431407" />
      </linearGradient>
      <filter id="vip_shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.8" />
      </filter>
    </defs>

    {/* Elaborate Gothic Obsidian Wings Left */}
    <g filter="url(#vip_shadow)">
      <path d="M 40 76 C 18 62 10 40 16 20 C 24 40 40 58 54 68 Z" fill="url(#vip_obsidian)" stroke="url(#vip_gold)" strokeWidth="1.5" />
      <path d="M 32 104 C 10 98 4 80 12 62 C 22 78 36 90 48 96 Z" fill="url(#vip_obsidian)" stroke="url(#vip_gold)" strokeWidth="1.5" />
      <path d="M 34 132 C 14 136 10 156 18 174 C 26 156 40 144 52 138 Z" fill="url(#vip_obsidian)" stroke="url(#vip_gold)" strokeWidth="1.5" />
    </g>

    {/* Elaborate Gothic Obsidian Wings Right */}
    <g filter="url(#vip_shadow)">
      <path d="M 160 76 C 182 62 190 40 184 20 C 176 40 160 58 146 68 Z" fill="url(#vip_obsidian)" stroke="url(#vip_gold)" strokeWidth="1.5" />
      <path d="M 168 104 C 190 98 196 80 188 62 C 178 78 164 90 152 96 Z" fill="url(#vip_obsidian)" stroke="url(#vip_gold)" strokeWidth="1.5" />
      <path d="M 166 132 C 186 136 190 156 182 174 C 174 156 160 144 148 138 Z" fill="url(#vip_obsidian)" stroke="url(#vip_gold)" strokeWidth="1.5" />
    </g>

    {/* Heavy Obsidian Outer Ring with Dual Gold Inlays */}
    <circle cx="100" cy="100" r="77" stroke="url(#vip_obsidian)" strokeWidth="9" filter="url(#vip_shadow)" />
    <circle cx="100" cy="100" r="81.5" stroke="url(#vip_gold)" strokeWidth="1.5" />
    <circle cx="100" cy="100" r="72.5" stroke="url(#vip_gold)" strokeWidth="1.5" />

    {/* Inner Glowing Amber Accent Ring */}
    <circle cx="100" cy="100" r="67" stroke="url(#vip_gold)" strokeWidth="2.5" />
    <circle cx="100" cy="100" r="65.5" stroke="#FEF08A" strokeWidth="1" strokeOpacity="0.8" />

    {/* Gold Filigree Studs */}
    <circle cx="45" cy="65" r="2.8" fill="url(#vip_gold)" stroke="#000000" strokeWidth="0.8" />
    <circle cx="155" cy="65" r="2.8" fill="url(#vip_gold)" stroke="#000000" strokeWidth="0.8" />
    <circle cx="45" cy="135" r="2.8" fill="url(#vip_gold)" stroke="#000000" strokeWidth="0.8" />
    <circle cx="155" cy="135" r="2.8" fill="url(#vip_gold)" stroke="#000000" strokeWidth="0.8" />

    {/* Top Imperial Obsidian & Gold Crown with Glowing Amber Core */}
    <g filter="url(#vip_shadow)">
      <path
        d="M 64 36 L 56 16 L 80 24 L 100 8 L 120 24 L 144 16 L 136 36 Q 100 44 64 36 Z"
        fill="url(#vip_obsidian)"
        stroke="url(#vip_gold)"
        strokeWidth="1.8"
      />
      {/* Central Amber Sunstone Cabochon */}
      <circle cx="100" cy="24" r="5" fill="url(#vip_amber)" stroke="url(#vip_gold)" strokeWidth="1.5" />
      <circle cx="98" cy="22" r="1.5" fill="#FFFFFF" />
      {/* Crown tips jewels */}
      <circle cx="56" cy="16" r="2.5" fill="url(#vip_gold)" />
      <circle cx="144" cy="16" r="2.5" fill="url(#vip_gold)" />
      <circle cx="100" cy="8" r="3" fill="url(#vip_amber)" stroke="url(#vip_gold)" strokeWidth="1" />
    </g>

    {/* Bottom VIP Imperial Plaque */}
    <g filter="url(#vip_shadow)">
      <path d="M 72 164 L 100 192 L 128 164 L 100 156 Z" fill="url(#vip_obsidian)" stroke="url(#vip_gold)" strokeWidth="1.8" />
      {/* VIP Emblem Text or Inlay */}
      <polygon points="100,166 106,176 116,176 108,183 111,192 100,186 89,192 92,183 84,176 94,176" fill="url(#vip_gold)" />
      <circle cx="100" cy="176" r="2.5" fill="url(#vip_amber)" />
    </g>
  </svg>
);

// ----------------------------------------------------
// 5. STORY — ستوري (Vibrant Electric Purple, Magenta & Cyan HUD)
// ----------------------------------------------------
const StoryFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="sty_neon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22D3EE" />
        <stop offset="35%" stopColor="#A855F7" />
        <stop offset="70%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="sty_cyan" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#67E8F9" />
      </linearGradient>
      <linearGradient id="sty_magenta" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#F43F5E" />
        <stop offset="100%" stopColor="#A855F7" />
      </linearGradient>
      <filter id="sty_glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#A855F7" floodOpacity="0.75" />
      </filter>
    </defs>

    {/* Cyber-Mech Shards Left */}
    <g filter="url(#sty_glow)">
      <polygon points="42,42 16,28 28,58 48,52" fill="url(#sty_neon)" stroke="#22D3EE" strokeWidth="1.2" />
      <polygon points="32,74 8,84 26,104 44,92" fill="url(#sty_magenta)" stroke="#F43F5E" strokeWidth="1.2" />
      <polygon points="36,126 10,138 32,156 46,140" fill="url(#sty_neon)" stroke="#22D3EE" strokeWidth="1.2" />
      <polygon points="46,158 20,176 48,172 56,154" fill="url(#sty_magenta)" stroke="#A855F7" strokeWidth="1.2" />
    </g>

    {/* Cyber-Mech Shards Right */}
    <g filter="url(#sty_glow)">
      <polygon points="158,42 184,28 172,58 152,52" fill="url(#sty_neon)" stroke="#22D3EE" strokeWidth="1.2" />
      <polygon points="168,74 192,84 174,104 156,92" fill="url(#sty_magenta)" stroke="#F43F5E" strokeWidth="1.2" />
      <polygon points="164,126 190,138 168,156 154,140" fill="url(#sty_neon)" stroke="#22D3EE" strokeWidth="1.2" />
      <polygon points="154,158 180,176 152,172 144,154" fill="url(#sty_magenta)" stroke="#A855F7" strokeWidth="1.2" />
    </g>

    {/* Neon Gradient Layered Outer Ring */}
    <circle cx="100" cy="100" r="77" stroke="url(#sty_neon)" strokeWidth="7" filter="url(#sty_glow)" />
    <circle cx="100" cy="100" r="81" stroke="#3B0764" strokeWidth="1.5" />
    <circle cx="100" cy="100" r="73" stroke="#3B0764" strokeWidth="1.5" />

    {/* Inner Laser Cyan Circuit Ring */}
    <circle cx="100" cy="100" r="67" stroke="url(#sty_cyan)" strokeWidth="2.5" />
    <circle cx="100" cy="100" r="65.5" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.9" />

    {/* Cyber Tech Brackets at 4 Angles */}
    <path d="M 46 64 L 40 60 L 40 50" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
    <path d="M 154 64 L 160 60 L 160 50" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
    <path d="M 46 136 L 40 140 L 40 150" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
    <path d="M 154 136 L 160 140 L 160 150" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />

    {/* Top Holographic Gaming Diamond Tiara */}
    <g filter="url(#sty_glow)">
      <polygon points="100,10 118,28 100,38 82,28" fill="url(#sty_neon)" stroke="#67E8F9" strokeWidth="1.5" />
      <polygon points="100,12 114,26 100,26" fill="#FFFFFF" fillOpacity="0.9" />
      <circle cx="100" cy="24" r="3.5" fill="#22D3EE" stroke="#FFFFFF" strokeWidth="1" />
      {/* Lateral energy wings */}
      <path d="M 78 28 L 62 20 L 70 34" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" />
      <path d="M 122 28 L 138 20 L 130 34" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" />
    </g>

    {/* Bottom Cyber Thruster Chevron */}
    <g filter="url(#sty_glow)">
      <path d="M 72 166 L 100 190 L 128 166 L 116 160 L 100 174 L 84 160 Z" fill="url(#sty_neon)" stroke="#F43F5E" strokeWidth="1.5" />
      <polygon points="100,176 106,184 100,188 94,184" fill="#67E8F9" />
      <circle cx="100" cy="182" r="1.5" fill="#FFFFFF" />
    </g>
  </svg>
);

// ----------------------------------------------------
// 6. CHALLENGE — تحدي (Fiery Crimson, Molten Orange & Aggressive Spikes)
// ----------------------------------------------------
const ChallengeFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="chg_fire" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="25%" stopColor="#F97316" />
        <stop offset="60%" stopColor="#DC2626" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
      <linearGradient id="chg_molten" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="40%" stopColor="#EA580C" />
        <stop offset="100%" stopColor="#991B1B" />
      </linearGradient>
      <linearGradient id="chg_armor" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#450A0A" />
        <stop offset="50%" stopColor="#7F1D1D" />
        <stop offset="100%" stopColor="#18181B" />
      </linearGradient>
      <filter id="chg_shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#7F1D1D" floodOpacity="0.65" />
      </filter>
    </defs>

    {/* Aggressive Warrior Spikes Left */}
    <g filter="url(#chg_shadow)">
      <polygon points="46,46 14,24 32,60 54,54" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
      <polygon points="46,46 14,24 34,44" fill="#FEF08A" fillOpacity="0.8" />

      <polygon points="34,78 6,86 28,108 46,94" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
      <polygon points="34,78 6,86 26,86" fill="#FEF08A" fillOpacity="0.8" />

      <polygon points="36,124 8,140 32,158 48,138" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
      <polygon points="48,156 18,178 48,170 58,150" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
    </g>

    {/* Aggressive Warrior Spikes Right */}
    <g filter="url(#chg_shadow)">
      <polygon points="154,46 186,24 168,60 146,54" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
      <polygon points="154,46 186,24 166,44" fill="#FEF08A" fillOpacity="0.8" />

      <polygon points="166,78 194,86 172,108 154,94" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
      <polygon points="166,78 194,86 174,86" fill="#FEF08A" fillOpacity="0.8" />

      <polygon points="164,124 192,140 168,158 152,138" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
      <polygon points="152,156 182,178 152,170 142,150" fill="url(#chg_fire)" stroke="#7F1D1D" strokeWidth="1.5" />
    </g>

    {/* Heavy Molten Forged Outer Ring */}
    <circle cx="100" cy="100" r="77" stroke="url(#chg_fire)" strokeWidth="8" filter="url(#chg_shadow)" />
    <circle cx="100" cy="100" r="81" stroke="#450A0A" strokeWidth="1.5" />
    <circle cx="100" cy="100" r="73" stroke="#450A0A" strokeWidth="1.5" />

    {/* Inner Molten Glow Ring */}
    <circle cx="100" cy="100" r="67" stroke="url(#chg_molten)" strokeWidth="3" />
    <circle cx="100" cy="100" r="65.5" stroke="#FEF08A" strokeWidth="1" strokeOpacity="0.9" />

    {/* Molten Rivets at Cardinal Coordinates */}
    <circle cx="46" cy="66" r="2.5" fill="#FEF08A" stroke="#450A0A" strokeWidth="1" />
    <circle cx="154" cy="66" r="2.5" fill="#FEF08A" stroke="#450A0A" strokeWidth="1" />
    <circle cx="46" cy="134" r="2.5" fill="#FEF08A" stroke="#450A0A" strokeWidth="1" />
    <circle cx="154" cy="134" r="2.5" fill="#FEF08A" stroke="#450A0A" strokeWidth="1" />

    {/* Top Blazing Warrior Battle Horns Crest */}
    <g filter="url(#chg_shadow)">
      <path
        d="M 64 36 L 52 14 L 78 24 L 100 6 L 122 24 L 148 14 L 136 36 Q 100 44 64 36 Z"
        fill="url(#chg_fire)"
        stroke="#450A0A"
        strokeWidth="1.8"
      />
      {/* Glowing molten core gem */}
      <polygon points="100,16 108,28 100,34 92,28" fill="#FEF08A" stroke="#450A0A" strokeWidth="1" />
      <circle cx="100" cy="26" r="2" fill="#FFFFFF" />
    </g>

    {/* Bottom Spiked Battle Gorget Shield */}
    <g filter="url(#chg_shadow)">
      <path d="M 74 164 L 100 192 L 126 164 L 100 156 Z" fill="url(#chg_fire)" stroke="#450A0A" strokeWidth="1.8" />
      <polygon points="100,166 104,176 114,176 106,182 109,191 100,185 91,191 94,182 86,176 96,176" fill="#FEF08A" stroke="#450A0A" strokeWidth="0.8" />
    </g>
  </svg>
);

// ----------------------------------------------------
// 7. NATURE — طبيعة (Emerald Green, Jade & Brushed Gold Vines)
// ----------------------------------------------------
const NatureFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="nat_emerald" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A7F3D0" />
        <stop offset="25%" stopColor="#34D399" />
        <stop offset="55%" stopColor="#10B981" />
        <stop offset="85%" stopColor="#047857" />
        <stop offset="100%" stopColor="#064E3B" />
      </linearGradient>
      <linearGradient id="nat_gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="nat_jade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ECFDF5" />
        <stop offset="50%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#064E3B" />
      </linearGradient>
      <filter id="nat_shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#064E3B" floodOpacity="0.55" />
      </filter>
    </defs>

    {/* Symmetrical Left Botanical Jade Leaves */}
    <g filter="url(#nat_shadow)">
      <path d="M 38 78 C 18 64 12 42 22 24 C 30 42 46 58 58 66 Z" fill="url(#nat_emerald)" stroke="#064E3B" strokeWidth="1.3" />
      <path d="M 40 72 C 28 62 24 50 30 38" stroke="url(#nat_gold)" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 30 106 C 10 98 6 78 16 60 C 26 78 40 90 52 96 Z" fill="url(#nat_emerald)" stroke="#064E3B" strokeWidth="1.3" />
      <path d="M 32 100 C 20 92 18 80 24 70" stroke="url(#nat_gold)" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 34 130 C 14 134 10 154 20 170 C 28 154 42 142 54 136 Z" fill="url(#nat_emerald)" stroke="#064E3B" strokeWidth="1.3" />
      <path d="M 36 136 C 24 140 22 152 28 160" stroke="url(#nat_gold)" strokeWidth="1.2" strokeLinecap="round" />
    </g>

    {/* Symmetrical Right Botanical Jade Leaves */}
    <g filter="url(#nat_shadow)">
      <path d="M 162 78 C 182 64 188 42 178 24 C 170 42 154 58 142 66 Z" fill="url(#nat_emerald)" stroke="#064E3B" strokeWidth="1.3" />
      <path d="M 160 72 C 172 62 176 50 170 38" stroke="url(#nat_gold)" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 170 106 C 190 98 194 78 184 60 C 174 78 160 90 148 96 Z" fill="url(#nat_emerald)" stroke="#064E3B" strokeWidth="1.3" />
      <path d="M 168 100 C 180 92 182 80 176 70" stroke="url(#nat_gold)" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M 166 130 C 186 134 190 154 180 170 C 172 154 158 142 146 136 Z" fill="url(#nat_emerald)" stroke="#064E3B" strokeWidth="1.3" />
      <path d="M 164 136 C 176 140 178 152 172 160" stroke="url(#nat_gold)" strokeWidth="1.2" strokeLinecap="round" />
    </g>

    {/* Outer Jade Ring Bevel */}
    <circle cx="100" cy="100" r="77" stroke="url(#nat_emerald)" strokeWidth="8" filter="url(#nat_shadow)" />
    <circle cx="100" cy="100" r="81" stroke="#064E3B" strokeWidth="1.3" />
    <circle cx="100" cy="100" r="73" stroke="#064E3B" strokeWidth="1.3" />

    {/* Inner Brushed-Gold Vine Ring */}
    <circle cx="100" cy="100" r="67" stroke="url(#nat_gold)" strokeWidth="3" />
    <circle cx="100" cy="100" r="65.5" stroke="#A7F3D0" strokeWidth="1" strokeOpacity="0.8" />

    {/* Golden Vine Nodes at Cardinal Points */}
    <circle cx="46" cy="66" r="2.5" fill="url(#nat_gold)" stroke="#064E3B" strokeWidth="1" />
    <circle cx="154" cy="66" r="2.5" fill="url(#nat_gold)" stroke="#064E3B" strokeWidth="1" />
    <circle cx="46" cy="134" r="2.5" fill="url(#nat_gold)" stroke="#064E3B" strokeWidth="1" />
    <circle cx="154" cy="134" r="2.5" fill="url(#nat_gold)" stroke="#064E3B" strokeWidth="1" />

    {/* Top Enchanted Lotus & Jade Jewel */}
    <g filter="url(#nat_shadow)">
      {/* Golden leaf bracket */}
      <path d="M 68 38 Q 100 24 132 38 Q 100 48 68 38 Z" fill="url(#nat_gold)" stroke="#064E3B" strokeWidth="1.3" />
      {/* Central Jade Diamond Lotus */}
      <polygon points="100,12 114,28 100,42 86,28" fill="url(#nat_emerald)" stroke="url(#nat_gold)" strokeWidth="1.5" />
      <polygon points="100,14 112,28 100,28" fill="#ECFDF5" />
      <circle cx="100" cy="28" r="3.5" fill="#A7F3D0" stroke="#064E3B" strokeWidth="1" />
      <circle cx="98.5" cy="26.5" r="1" fill="#FFFFFF" />
    </g>

    {/* Bottom Golden Root Guard & Jade Pearl */}
    <g filter="url(#nat_shadow)">
      <path d="M 76 162 Q 100 156 124 162 L 100 188 Z" fill="url(#nat_gold)" stroke="#064E3B" strokeWidth="1.5" />
      <circle cx="100" cy="172" r="4.5" fill="url(#nat_emerald)" stroke="url(#nat_gold)" strokeWidth="1.2" />
      <circle cx="98.5" cy="170.5" r="1.5" fill="#FFFFFF" />
    </g>
  </svg>
);

// ----------------------------------------------------
// 8. COSMIC — كوني (Deep Navy, Electric Blue & Orbital Star Systems)
// ----------------------------------------------------
const CosmicFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 200 200"
    className={`w-full h-full pointer-events-none drop-shadow-md select-none ${className}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="cos_nebula" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="30%" stopColor="#6366F1" />
        <stop offset="70%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#0B1120" />
      </linearGradient>
      <linearGradient id="cos_starlight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="50%" stopColor="#7DD3FC" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
      <linearGradient id="cos_orbit" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
        <stop offset="50%" stopColor="#A855F7" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8" />
      </linearGradient>
      <filter id="cos_glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.75" />
      </filter>
    </defs>

    {/* Outer Planetary Orbital Ring 1 (Tilted Ellipse) */}
    <ellipse cx="100" cy="100" rx="92" ry="42" stroke="url(#cos_orbit)" strokeWidth="1.8" transform="rotate(-30 100 100)" />
    <circle cx="28" cy="62" r="3" fill="#38BDF8" filter="url(#cos_glow)" />
    <circle cx="172" cy="138" r="2.5" fill="#A855F7" filter="url(#cos_glow)" />

    {/* Outer Planetary Orbital Ring 2 (Tilted Ellipse) */}
    <ellipse cx="100" cy="100" rx="92" ry="42" stroke="url(#cos_orbit)" strokeWidth="1.8" transform="rotate(30 100 100)" />
    <circle cx="172" cy="62" r="3" fill="#38BDF8" filter="url(#cos_glow)" />
    <circle cx="28" cy="138" r="2.5" fill="#A855F7" filter="url(#cos_glow)" />

    {/* Heavy Nebula Void Outer Ring */}
    <circle cx="100" cy="100" r="77" stroke="url(#cos_nebula)" strokeWidth="8" filter="url(#cos_glow)" />
    <circle cx="100" cy="100" r="81" stroke="#0B1120" strokeWidth="1.5" />
    <circle cx="100" cy="100" r="73" stroke="#0B1120" strokeWidth="1.5" />

    {/* Inner Luminous Starlight Ring */}
    <circle cx="100" cy="100" r="67" stroke="url(#cos_starlight)" strokeWidth="3" />
    <circle cx="100" cy="100" r="65.5" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.9" />

    {/* Constellation Stars on Ring Nodes */}
    <circle cx="46" cy="66" r="2.5" fill="#FFFFFF" filter="url(#cos_glow)" />
    <circle cx="154" cy="66" r="2.5" fill="#FFFFFF" filter="url(#cos_glow)" />
    <circle cx="46" cy="134" r="2.5" fill="#FFFFFF" filter="url(#cos_glow)" />
    <circle cx="154" cy="134" r="2.5" fill="#FFFFFF" filter="url(#cos_glow)" />

    {/* Top Radiant 8-Pointed Polaris Star Headpiece */}
    <g filter="url(#cos_glow)">
      {/* Radiance rays */}
      <path d="M 100 2 L 100 38 M 82 20 L 118 20" stroke="#E0F2FE" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 87 7 L 113 33 M 113 7 L 87 33" stroke="#7DD3FC" strokeWidth="1" strokeLinecap="round" />
      {/* Faceted Star */}
      <polygon
        points="100,6 105,16 116,20 105,24 100,34 95,24 84,20 95,16"
        fill="url(#cos_starlight)"
        stroke="#0B1120"
        strokeWidth="1.2"
      />
      <circle cx="100" cy="20" r="3" fill="#FFFFFF" />
    </g>

    {/* Bottom Cosmic Crescent Moon & Stardust Seal */}
    <g filter="url(#cos_glow)">
      <path
        d="M 86 162 C 86 178 98 188 114 188 C 104 186 98 178 98 168 C 98 162 100 158 104 154 C 94 156 86 158 86 162 Z"
        fill="url(#cos_starlight)"
        stroke="#0B1120"
        strokeWidth="1"
      />
      <circle cx="114" cy="172" r="3.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1" />
      <circle cx="113" cy="171" r="1" fill="#FFFFFF" />
    </g>
  </svg>
);

// ----------------------------------------------------
// Master Component with Legacy Aliases Preserved
// ----------------------------------------------------
export const AchievementFrameSVG: React.FC<FrameSVGProps> = ({ frame, className = '' }) => {
  if (!frame || frame === 'none' || frame === 'default') {
    return null;
  }

  switch (frame) {
    // Silver tier & legacy aliases
    case 'silver':
    case 'silver_scholar':
      return <SilverFrame className={className} />;

    // Gold tier & legacy aliases
    case 'gold':
    case 'gold_champion':
      return <GoldFrame className={className} />;

    // Platinum tier
    case 'platinum':
      return <PlatinumFrame className={className} />;

    // VIP tier & legacy aliases (crown, champion)
    case 'vip':
    case 'crown':
    case 'champion':
      return <VipFrame className={className} />;

    // Story tier & legacy alias (diamond_elite)
    case 'story':
    case 'diamond_elite':
      return <StoryFrame className={className} />;

    // Challenge tier & legacy alias (bronze_star)
    case 'challenge':
    case 'bronze_star':
      return <ChallengeFrame className={className} />;

    // Nature tier & legacy alias (emerald_honor)
    case 'nature':
    case 'emerald_honor':
      return <NatureFrame className={className} />;

    // Cosmic tier & legacy alias (star)
    case 'cosmic':
    case 'star':
      return <CosmicFrame className={className} />;

    default:
      return null;
  }
};
