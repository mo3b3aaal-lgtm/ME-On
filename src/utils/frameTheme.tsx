import React from 'react';
import { AchievementFrame } from '../types';

export interface FrameCardTheme {
  frameKey: AchievementFrame;
  icon: string;
  nameAr: string;
  nameEn: string;
  tierAr: string;
  tierEn: string;
  cardBgClass: string;
  cardBorderClass: string;
  pillClass: string;
  glowColor: string;
  patternType: 'platinum' | 'gold' | 'vip' | 'story' | 'challenge' | 'nature' | 'cosmic' | 'silver';
}

/**
 * Derives a subtle background theme and label identity from the student's existing achievement frame.
 * Strict adherence: Reuses existing frames and metadata only. Returns null if no frame is assigned.
 */
export function getStudentFrameCardTheme(rawFrame?: string | null): FrameCardTheme | null {
  if (!rawFrame || rawFrame === 'none' || rawFrame === 'default') {
    return null;
  }

  const clean = rawFrame.trim().toLowerCase();

  // 1. Platinum (بلاتينيوم) — Icy crystalline highlights & silver-blue
  if (clean === 'platinum') {
    return {
      frameKey: 'platinum',
      icon: '💎',
      nameAr: 'إطار بلاتينيوم',
      nameEn: 'Platinum Frame',
      tierAr: 'بلاتينيوم',
      tierEn: 'Platinum',
      cardBgClass: 'bg-gradient-to-br from-[#F0F9FF]/95 via-white/95 to-[#E0F2FE]/75',
      cardBorderClass: 'border-[#BAE6FD] hover:border-[#7DD3FC] shadow-xs',
      pillClass: 'bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1]',
      glowColor: 'rgba(56, 189, 248, 0.35)',
      patternType: 'platinum',
    };
  }

  // 2. Gold (ذهبي) — Rich metallic gold & warm reflections
  if (clean === 'gold' || clean === 'gold_champion') {
    return {
      frameKey: 'gold',
      icon: '👑',
      nameAr: 'إطار ذهبي',
      nameEn: 'Gold Frame',
      tierAr: 'ذهبي',
      tierEn: 'Gold',
      cardBgClass: 'bg-gradient-to-br from-[#FFFDF5]/95 via-white/95 to-[#FEF3C7]/65',
      cardBorderClass: 'border-[#FDE68A] hover:border-[#FCD34D] shadow-xs',
      pillClass: 'bg-[#FFFDF5] border-[#FDE68A] text-[#B45309]',
      glowColor: 'rgba(245, 158, 11, 0.35)',
      patternType: 'gold',
    };
  }

  // 3. VIP (VIP) — Obsidian luxury & amber glow
  if (clean === 'vip' || clean === 'crown' || clean === 'champion') {
    return {
      frameKey: 'vip',
      icon: '⭐',
      nameAr: 'إطار VIP',
      nameEn: 'VIP Frame',
      tierAr: 'VIP',
      tierEn: 'VIP',
      cardBgClass: 'bg-gradient-to-br from-[#FFFBEB]/95 via-white/95 to-[#FEF08A]/50',
      cardBorderClass: 'border-[#FCD34D] hover:border-[#F59E0B] shadow-xs',
      pillClass: 'bg-[#FEF3C7] border-[#FCD34D] text-[#92400E]',
      glowColor: 'rgba(217, 119, 6, 0.35)',
      patternType: 'vip',
    };
  }

  // 4. Story (ستوري) — Electric purple, magenta & cyber cyan
  if (clean === 'story' || clean === 'diamond_elite') {
    return {
      frameKey: 'story',
      icon: '⚡',
      nameAr: 'إطار ستوري',
      nameEn: 'Story Frame',
      tierAr: 'ستوري',
      tierEn: 'Story',
      cardBgClass: 'bg-gradient-to-br from-[#FAF5FF]/95 via-white/95 to-[#F3E8FF]/70',
      cardBorderClass: 'border-[#E9D5FF] hover:border-[#D8B4FE] shadow-xs',
      pillClass: 'bg-[#FAF5FF] border-[#E9D5FF] text-[#7E22CE]',
      glowColor: 'rgba(168, 85, 247, 0.35)',
      patternType: 'story',
    };
  }

  // 5. Challenge (تحدي) — Fiery red, molten-orange & sharp armor
  if (clean === 'challenge' || clean === 'bronze_star') {
    return {
      frameKey: 'challenge',
      icon: '🔥',
      nameAr: 'إطار تحدي',
      nameEn: 'Challenge Frame',
      tierAr: 'تحدي',
      tierEn: 'Challenge',
      cardBgClass: 'bg-gradient-to-br from-[#FFF5F5]/95 via-white/95 to-[#FEE2E2]/65',
      cardBorderClass: 'border-[#FECACA] hover:border-[#FCA5A5] shadow-xs',
      pillClass: 'bg-[#FFF5F5] border-[#FECACA] text-[#B91C1C]',
      glowColor: 'rgba(239, 68, 68, 0.35)',
      patternType: 'challenge',
    };
  }

  // 6. Nature (طبيعة) — Emerald jade & brushed-gold laurel accents
  if (clean === 'nature' || clean === 'emerald_honor') {
    return {
      frameKey: 'nature',
      icon: '🍃',
      nameAr: 'إطار طبيعة',
      nameEn: 'Nature Frame',
      tierAr: 'طبيعة',
      tierEn: 'Nature',
      cardBgClass: 'bg-gradient-to-br from-[#F0FDF4]/95 via-white/95 to-[#DCFCE7]/65',
      cardBorderClass: 'border-[#BBF7D0] hover:border-[#86EFAC] shadow-xs',
      pillClass: 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]',
      glowColor: 'rgba(16, 185, 129, 0.35)',
      patternType: 'nature',
    };
  }

  // 7. Cosmic (كوني) — Celestial space navy, violet & orbital stars
  if (clean === 'cosmic' || clean === 'star') {
    return {
      frameKey: 'cosmic',
      icon: '🌠',
      nameAr: 'إطار كوني',
      nameEn: 'Cosmic Frame',
      tierAr: 'كوني',
      tierEn: 'Cosmic',
      cardBgClass: 'bg-gradient-to-br from-[#EEF2FF]/95 via-white/95 to-[#E0E7FF]/70',
      cardBorderClass: 'border-[#C7D2FE] hover:border-[#A5B4FC] shadow-xs',
      pillClass: 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]',
      glowColor: 'rgba(99, 102, 241, 0.35)',
      patternType: 'cosmic',
    };
  }

  // 8. Silver (فضي) — Polished steel, cool highlights & silver laurel
  if (clean === 'silver' || clean === 'silver_scholar') {
    return {
      frameKey: 'silver',
      icon: '💎',
      nameAr: 'إطار فضي',
      nameEn: 'Silver Frame',
      tierAr: 'فضي',
      tierEn: 'Silver',
      cardBgClass: 'bg-gradient-to-br from-[#F8FAFC]/95 via-white/95 to-[#F1F5F9]/85',
      cardBorderClass: 'border-[#CBD5E1] hover:border-[#94A3B8] shadow-xs',
      pillClass: 'bg-[#F8FAFC] border-[#CBD5E1] text-[#334155]',
      glowColor: 'rgba(148, 163, 184, 0.35)',
      patternType: 'silver',
    };
  }

  return null;
}

/**
 * Extremely low-opacity (5-8%) edge/corner decorative watermark inspired by the existing frame's design.
 * Positioned absolute at the corner, pointer-events-none, never covers text or interferes with contrast.
 */
export const FrameCornerWatermark: React.FC<{
  patternType: FrameCardTheme['patternType'];
  className?: string;
}> = ({ patternType, className = '' }) => {
  switch (patternType) {
    case 'platinum':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.08] select-none text-sky-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120 0 L60 0 L120 60 Z" fill="currentColor" />
          <path d="M120 60 L80 20 L120 0 Z" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="100,15 115,30 100,45 85,30" stroke="currentColor" strokeWidth="1.2" />
          <line x1="60" y1="0" x2="120" y2="60" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="40" y1="0" x2="120" y2="80" stroke="currentColor" strokeWidth="0.8" />
        </svg>
      );

    case 'gold':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.07] select-none text-amber-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="120" cy="0" r="70" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="120" cy="0" r="90" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" />
          <path d="M120 20 C100 20 85 35 85 55" stroke="currentColor" strokeWidth="1.2" />
          <path d="M105 10 C90 25 80 45 80 70" stroke="currentColor" strokeWidth="1" />
          <polygon points="110,35 115,45 105,45" fill="currentColor" />
          <polygon points="95,50 100,60 90,60" fill="currentColor" />
        </svg>
      );

    case 'vip':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.08] select-none text-amber-600 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120 0 L80 0 L120 40 Z" fill="currentColor" />
          <path d="M120 25 Q95 25 95 0" stroke="currentColor" strokeWidth="1.5" />
          <path d="M120 50 Q70 50 70 0" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <polygon points="105,10 115,20 105,30 95,20" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="105" cy="20" r="2" fill="currentColor" />
        </svg>
      );

    case 'story':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.07] select-none text-purple-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120 15 L95 15 L120 40 Z" fill="currentColor" />
          <line x1="70" y1="0" x2="120" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="90" y1="0" x2="120" y2="30" stroke="currentColor" strokeWidth="1" />
          <polygon points="105,25 110,35 100,35" fill="currentColor" />
          <polygon points="90,40 95,50 85,50" fill="currentColor" />
          <circle cx="85" cy="25" r="3" stroke="currentColor" strokeWidth="1" />
        </svg>
      );

    case 'challenge':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.07] select-none text-red-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120 0 L85 0 L120 35 Z" fill="currentColor" />
          <path d="M120 20 L95 45 L120 70" stroke="currentColor" strokeWidth="1.5" />
          <path d="M100 0 L75 25 L100 50" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <polygon points="105,15 115,25 105,35" fill="currentColor" />
        </svg>
      );

    case 'nature':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.08] select-none text-emerald-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120 0 C95 10 80 30 75 60 C90 45 110 35 120 35 Z" fill="currentColor" />
          <path d="M110 0 C90 20 80 40 85 70" stroke="currentColor" strokeWidth="1.2" />
          <path d="M95 15 C80 25 70 40 70 60" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="95" cy="35" r="2.5" fill="currentColor" />
          <circle cx="80" cy="55" r="2" fill="currentColor" />
        </svg>
      );

    case 'cosmic':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.08] select-none text-indigo-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="120" cy="0" rx="80" ry="35" transform="rotate(-30 120 0)" stroke="currentColor" strokeWidth="1.2" />
          <ellipse cx="120" cy="0" rx="100" ry="45" transform="rotate(-30 120 0)" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" />
          <circle cx="85" cy="30" r="3" fill="currentColor" />
          <circle cx="105" cy="50" r="2" fill="currentColor" />
          <polygon points="75,20 78,25 83,26 79,30 80,35 75,32 70,35 71,30 67,26 72,25" fill="currentColor" />
        </svg>
      );

    case 'silver':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.08] select-none text-slate-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120 0 L70 0 L120 50 Z" fill="currentColor" />
          <circle cx="120" cy="0" r="60" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="120" cy="0" r="80" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" />
          <polygon points="100,20 110,30 100,40 90,30" stroke="currentColor" strokeWidth="1" />
        </svg>
      );

    default:
      return null;
  }
};
