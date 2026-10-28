import React from 'react';
import { AchievementFrame, LevelFrameId } from '../types';
import {
  frameIdToLevel,
  LEVEL_FRAME_DEFINITIONS,
  normalizeManualOrLegacyFrame,
  resolveStudentLevelFrame,
} from './studentProgression';

export interface FrameCardTheme {
  frameKey: LevelFrameId;
  level: number;
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

type StudentFrameThemeInput =
  | {
      id?: string;
      achievementFrame?: AchievementFrame | null;
      avatarFrameMode?: 'auto' | 'manual';
    }
  | AchievementFrame
  | string
  | null
  | undefined;

/**
 * Derives a subtle card accent theme for higher progression tiers (Level 4 -> Level MAX),
 * while keeping Levels 1–3 on the crisp default Harbor Mint card surface so visual hierarchy stays calm.
 */
export function getStudentFrameCardTheme(input?: StudentFrameThemeInput): FrameCardTheme | null {
  if (!input) return null;

  let resolvedFrameId: LevelFrameId | null = null;
  if (typeof input === 'object') {
    resolvedFrameId = resolveStudentLevelFrame(input);
  } else {
    resolvedFrameId = normalizeManualOrLegacyFrame(input);
  }

  if (!resolvedFrameId) return null;

  const level = frameIdToLevel(resolvedFrameId);
  const def = LEVEL_FRAME_DEFINITIONS[level];

  // Levels 1–3 keep the calm Harbor Mint surface so cards never feel visually noisy
  if (level <= 3) {
    return null;
  }

  if (level === 4 || level === 5) {
    return {
      frameKey: resolvedFrameId,
      level,
      nameAr: def.titleAr,
      nameEn: def.titleEn,
      tierAr: def.shortLabelAr,
      tierEn: def.shortLabelEn,
      cardBgClass:
        'bg-gradient-to-br from-[#FFFDF5]/95 via-white/95 to-[#FEF3C7]/60 dark:from-[#2B2212]/95 dark:via-[#142336]/95 dark:to-[#332611]/90',
      cardBorderClass:
        'border-[#FDE68A] hover:border-[#FCD34D] dark:border-[#F59E0B]/45 dark:hover:border-[#FBBF24]/70 shadow-xs',
      pillClass:
        'bg-[#FFFDF5] border-[#FDE68A] text-[#B45309] dark:bg-[#362812] dark:border-[#F59E0B]/50 dark:text-[#FDE68A]',
      glowColor: 'rgba(245, 158, 11, 0.3)',
      patternType: 'gold',
    };
  }

  if (level === 6) {
    return {
      frameKey: resolvedFrameId,
      level,
      nameAr: def.titleAr,
      nameEn: def.titleEn,
      tierAr: def.shortLabelAr,
      tierEn: def.shortLabelEn,
      cardBgClass:
        'bg-gradient-to-br from-[#FAF5FF]/95 via-white/95 to-[#F3E8FF]/65 dark:from-[#23193E]/95 dark:via-[#122338]/95 dark:to-[#2C1D4B]/90',
      cardBorderClass:
        'border-[#E9D5FF] hover:border-[#D8B4FE] dark:border-[#C084FC]/45 dark:hover:border-[#D8B4FE]/70 shadow-xs',
      pillClass:
        'bg-[#FAF5FF] border-[#E9D5FF] text-[#7E22CE] dark:bg-[#2D1E4A] dark:border-[#C084FC]/50 dark:text-[#E9D5FF]',
      glowColor: 'rgba(168, 85, 247, 0.3)',
      patternType: 'story',
    };
  }

  if (level === 7) {
    return {
      frameKey: resolvedFrameId,
      level,
      nameAr: def.titleAr,
      nameEn: def.titleEn,
      tierAr: def.shortLabelAr,
      tierEn: def.shortLabelEn,
      cardBgClass:
        'bg-gradient-to-br from-[#FFFBEB]/95 via-white/95 to-[#FEF08A]/50 dark:from-[#2E2310]/95 dark:via-[#132235]/95 dark:to-[#382910]/90',
      cardBorderClass:
        'border-[#FCD34D] hover:border-[#F59E0B] dark:border-[#FBBF24]/50 dark:hover:border-[#FCD34D]/75 shadow-xs',
      pillClass:
        'bg-[#FEF3C7] border-[#FCD34D] text-[#92400E] dark:bg-[#3B2B11] dark:border-[#FBBF24]/55 dark:text-[#FEF08A]',
      glowColor: 'rgba(217, 119, 6, 0.32)',
      patternType: 'vip',
    };
  }

  if (level === 8) {
    return {
      frameKey: resolvedFrameId,
      level,
      nameAr: def.titleAr,
      nameEn: def.titleEn,
      tierAr: def.shortLabelAr,
      tierEn: def.shortLabelEn,
      cardBgClass:
        'bg-gradient-to-br from-[#F0F9FF]/95 via-white/95 to-[#FEF3C7]/45 dark:from-[#0F2942]/95 dark:via-[#112338]/95 dark:to-[#1E2E3B]/90',
      cardBorderClass:
        'border-[#BAE6FD] hover:border-[#7DD3FC] dark:border-[#38BDF8]/40 dark:hover:border-[#7DD3FC]/65 shadow-xs',
      pillClass:
        'bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1] dark:bg-[#0C2D48] dark:border-[#38BDF8]/45 dark:text-[#BAE6FD]',
      glowColor: 'rgba(56, 189, 248, 0.32)',
      patternType: 'platinum',
    };
  }

  if (level === 9) {
    return {
      frameKey: resolvedFrameId,
      level,
      nameAr: def.titleAr,
      nameEn: def.titleEn,
      tierAr: def.shortLabelAr,
      tierEn: def.shortLabelEn,
      cardBgClass:
        'bg-gradient-to-br from-[#F5F3FF]/95 via-white/95 to-[#FEF3C7]/50 dark:from-[#1B1F47]/95 dark:via-[#112338]/95 dark:to-[#2A2046]/90',
      cardBorderClass:
        'border-[#DDD6FE] hover:border-[#C4B5FD] dark:border-[#A78BFA]/45 dark:hover:border-[#C4B5FD]/70 shadow-xs',
      pillClass:
        'bg-[#F5F3FF] border-[#DDD6FE] text-[#6D28D9] dark:bg-[#1D2854] dark:border-[#A78BFA]/50 dark:text-[#DDD6FE]',
      glowColor: 'rgba(109, 40, 217, 0.34)',
      patternType: 'cosmic',
    };
  }

  // Level 10 — Level MAX (Celestial Winged Sunburst)
  return {
    frameKey: 'level_10',
    level: 10,
    nameAr: def.titleAr,
    nameEn: def.titleEn,
    tierAr: def.shortLabelAr,
    tierEn: def.shortLabelEn,
    cardBgClass:
      'bg-gradient-to-br from-[#F0F9FF]/95 via-[#FFFDF7]/95 to-[#E0F2FE]/70 dark:from-[#102A45]/95 dark:via-[#16263B]/95 dark:to-[#2B2518]/90',
    cardBorderClass:
      'border-[#7DD3FC] hover:border-[#38BDF8] dark:border-[#38BDF8]/50 dark:hover:border-[#FBBF24]/70 shadow-xs',
    pillClass:
      'bg-[#F0F9FF] border-[#7DD3FC] text-[#0369A1] dark:bg-[#0C2D48] dark:border-[#38BDF8]/55 dark:text-[#E0F2FE]',
    glowColor: 'rgba(56, 189, 248, 0.38)',
    patternType: 'platinum',
  };
}

/**
 * Subtle corner geometric accent (5-8% opacity) for high-level student cards.
 */
export const FrameCornerWatermark: React.FC<{
  patternType: FrameCardTheme['patternType'];
  className?: string;
}> = React.memo(({ patternType, className = '' }) => {
  switch (patternType) {
    case 'platinum':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.07] select-none text-sky-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120 0 L60 0 L120 60 Z" fill="currentColor" />
          <path d="M120 60 L80 20 L120 0 Z" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="100,15 115,30 100,45 85,30" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );

    case 'gold':
    case 'vip':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.07] select-none text-amber-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="120" cy="0" r="70" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="120" cy="0" r="90" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" />
          <polygon points="105,15 115,25 105,35 95,25" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );

    case 'story':
    case 'cosmic':
      return (
        <svg
          viewBox="0 0 120 120"
          className={`absolute top-0 end-0 w-28 h-28 pointer-events-none opacity-[0.07] select-none text-purple-500 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="120" cy="0" rx="80" ry="35" transform="rotate(-30 120 0)" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="85" cy="30" r="2.5" fill="currentColor" />
        </svg>
      );

    default:
      return null;
  }
});
