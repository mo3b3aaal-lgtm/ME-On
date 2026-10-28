import React from 'react';
import { AppIcon, type AppIconName } from './ui/AppIcon';
import { AchievementFrame, LevelFrameId, StudentProgressionLevel } from '../types';
import { AchievementFrameSVG } from './AchievementFramesSVG';
import { useTranslation } from '../utils/i18n';
import {
  frameIdToLevel,
  LEVEL_FRAME_DEFINITIONS,
  resolveStudentLevelFrame,
} from '../utils/studentProgression';

export interface StudentAvatarProps {
  student?: {
    id?: string;
    name?: string;
    avatarColor?: string;
    profilePhoto?: string | null;
    achievementFrame?: AchievementFrame | null;
    avatarFrameMode?: 'auto' | 'manual';
    levelBonusPoints?: number;
  } | null;
  name?: string;
  avatarColor?: string;
  profilePhoto?: string | null;
  achievementFrame?: AchievementFrame | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBadge?: boolean;
  showFrame?: boolean;
}

type AvatarSizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface LevelSizeGeometry {
  container: string;
  inner: string;
  frame: string;
}

const NO_FRAME_CONTAINER_BY_SIZE: Record<AvatarSizeKey, string> = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm font-bold',
  lg: 'w-14 h-14 text-base font-bold',
  xl: 'w-20 h-20 text-xl font-bold',
  '2xl': 'w-24 h-24 text-2xl font-black',
};

const BADGE_CONFIG_BY_SIZE: Record<AvatarSizeKey, { badge: string; iconSize: string }> = {
  xs: { badge: 'w-3 h-3 -top-0.5 -right-0.5 text-[8px]', iconSize: 'w-2 h-2' },
  sm: { badge: 'w-4 h-4 -top-1 -right-1 text-[9px]', iconSize: 'w-2.5 h-2.5' },
  md: { badge: 'w-5 h-5 -top-1 -right-1 text-[10px]', iconSize: 'w-3 h-3' },
  lg: { badge: 'w-6 h-6 -top-1.5 -right-1.5 text-xs', iconSize: 'w-3.5 h-3.5' },
  xl: { badge: 'w-7 h-7 -top-2 -right-2 text-xs', iconSize: 'w-4 h-4' },
  '2xl': { badge: 'w-8 h-8 -top-2.5 -right-2.5 text-sm', iconSize: 'w-4.5 h-4.5' },
};

/**
 * Exact pixel-calibrated geometry per avatar size and Level 1..10 transparent inner hole ratio,
 * ensuring zero gap and zero outside clipping using pure static Tailwind utility classes.
 */
const FRAMED_GEOMETRY: Record<AvatarSizeKey, Record<StudentProgressionLevel, LevelSizeGeometry>> = {
  xs: {
    1: { container: 'w-8 h-8 text-[9px]', inner: 'w-[22px] h-[22px]', frame: 'w-[29px] h-[29px]' },
    2: { container: 'w-8 h-8 text-[9px]', inner: 'w-[21px] h-[21px]', frame: 'w-[30px] h-[30px]' },
    3: { container: 'w-8 h-8 text-[9px]', inner: 'w-5 h-5', frame: 'w-[30px] h-[30px]' },
    4: { container: 'w-8 h-8 text-[9px]', inner: 'w-5 h-5', frame: 'w-[30px] h-[30px]' },
    5: { container: 'w-8 h-8 text-[9px]', inner: 'w-[18px] h-[18px]', frame: 'w-[31px] h-[31px]' },
    6: { container: 'w-8 h-8 text-[9px]', inner: 'w-[17px] h-[17px]', frame: 'w-8 h-8' },
    7: { container: 'w-8 h-8 text-[8px]', inner: 'w-4 h-4', frame: 'w-[31px] h-[31px]' },
    8: { container: 'w-[34px] h-8 text-[8px]', inner: 'w-[15px] h-[15px]', frame: 'w-[33px] h-[33px]' },
    9: { container: 'w-9 h-8 text-[8px]', inner: 'w-[15px] h-[15px]', frame: 'w-[34px] h-[34px]' },
    10: { container: 'w-[42px] h-9 text-[8px]', inner: 'w-[13px] h-[13px]', frame: 'w-[42px] h-[42px]' },
  },
  sm: {
    1: { container: 'w-11 h-11 text-xs', inner: 'w-[30px] h-[30px]', frame: 'w-[39px] h-[39px]' },
    2: { container: 'w-11 h-11 text-xs', inner: 'w-7 h-7', frame: 'w-[41px] h-[41px]' },
    3: { container: 'w-11 h-11 text-xs', inner: 'w-7 h-7', frame: 'w-[42px] h-[42px]' },
    4: { container: 'w-11 h-11 text-xs', inner: 'w-7 h-7', frame: 'w-[42px] h-[42px]' },
    5: { container: 'w-11 h-11 text-[11px]', inner: 'w-[25px] h-[25px]', frame: 'w-[43px] h-[43px]' },
    6: { container: 'w-11 h-11 text-[11px]', inner: 'w-[23px] h-[23px]', frame: 'w-[43px] h-[43px]' },
    7: { container: 'w-11 h-11 text-[11px]', inner: 'w-[23px] h-[23px]', frame: 'w-[45px] h-[45px]' },
    8: { container: 'w-[46px] h-11 text-[10px]', inner: 'w-[21px] h-[21px]', frame: 'w-[46px] h-[46px]' },
    9: { container: 'w-12 h-11 text-[10px]', inner: 'w-[21px] h-[21px]', frame: 'w-[47px] h-[47px]' },
    10: { container: 'w-14 h-11 text-[9px]', inner: 'w-[17px] h-[17px]', frame: 'w-14 h-14' },
  },
  md: {
    1: { container: 'w-14 h-14 text-sm font-bold', inner: 'w-[38px] h-[38px]', frame: 'w-[50px] h-[50px]' },
    2: { container: 'w-14 h-14 text-sm font-bold', inner: 'w-9 h-9', frame: 'w-[52px] h-[52px]' },
    3: { container: 'w-14 h-14 text-sm font-bold', inner: 'w-[35px] h-[35px]', frame: 'w-[53px] h-[53px]' },
    4: { container: 'w-14 h-14 text-sm font-bold', inner: 'w-[35px] h-[35px]', frame: 'w-[53px] h-[53px]' },
    5: { container: 'w-14 h-14 text-xs font-bold', inner: 'w-8 h-8', frame: 'w-[55px] h-[55px]' },
    6: { container: 'w-14 h-14 text-xs font-bold', inner: 'w-[30px] h-[30px]', frame: 'w-14 h-14' },
    7: { container: 'w-14 h-14 text-xs font-bold', inner: 'w-[29px] h-[29px]', frame: 'w-14 h-14' },
    8: { container: 'w-[58px] h-14 text-xs font-bold', inner: 'w-[26px] h-[26px]', frame: 'w-[57px] h-[57px]' },
    9: { container: 'w-[60px] h-14 text-xs font-bold', inner: 'w-[26px] h-[26px]', frame: 'w-[58px] h-[58px]' },
    10: { container: 'w-[70px] h-14 text-[11px] font-bold', inner: 'w-[21px] h-[21px]', frame: 'w-[69px] h-[69px]' },
  },
  lg: {
    1: { container: 'w-20 h-20 text-lg font-bold', inner: 'w-[54px] h-[54px]', frame: 'w-[71px] h-[71px]' },
    2: { container: 'w-20 h-20 text-lg font-bold', inner: 'w-[52px] h-[52px]', frame: 'w-[75px] h-[75px]' },
    3: { container: 'w-20 h-20 text-base font-bold', inner: 'w-[50px] h-[50px]', frame: 'w-[76px] h-[76px]' },
    4: { container: 'w-20 h-20 text-base font-bold', inner: 'w-[50px] h-[50px]', frame: 'w-[76px] h-[76px]' },
    5: { container: 'w-20 h-20 text-base font-bold', inner: 'w-[46px] h-[46px]', frame: 'w-[79px] h-[79px]' },
    6: { container: 'w-20 h-20 text-sm font-bold', inner: 'w-[42px] h-[42px]', frame: 'w-[79px] h-[79px]' },
    7: { container: 'w-20 h-20 text-sm font-bold', inner: 'w-[41px] h-[41px]', frame: 'w-20 h-20' },
    8: { container: 'w-[82px] h-20 text-sm font-bold', inner: 'w-[37px] h-[37px]', frame: 'w-[81px] h-[81px]' },
    9: { container: 'w-[84px] h-20 text-sm font-bold', inner: 'w-[37px] h-[37px]', frame: 'w-[83px] h-[83px]' },
    10: { container: 'w-[100px] h-20 text-xs font-bold', inner: 'w-[30px] h-[30px]', frame: 'w-[99px] h-[99px]' },
  },
  xl: {
    1: { container: 'w-28 h-28 text-2xl font-black', inner: 'w-[76px] h-[76px]', frame: 'w-[100px] h-[100px]' },
    2: { container: 'w-28 h-28 text-2xl font-black', inner: 'w-[72px] h-[72px]', frame: 'w-[104px] h-[104px]' },
    3: { container: 'w-28 h-28 text-xl font-black', inner: 'w-[70px] h-[70px]', frame: 'w-[106px] h-[106px]' },
    4: { container: 'w-28 h-28 text-xl font-black', inner: 'w-[70px] h-[70px]', frame: 'w-[106px] h-[106px]' },
    5: { container: 'w-28 h-28 text-xl font-black', inner: 'w-16 h-16', frame: 'w-[110px] h-[110px]' },
    6: { container: 'w-28 h-28 text-lg font-black', inner: 'w-[59px] h-[59px]', frame: 'w-[111px] h-[111px]' },
    7: { container: 'w-[114px] h-28 text-lg font-black', inner: 'w-[58px] h-[58px]', frame: 'w-[113px] h-[113px]' },
    8: { container: 'w-[114px] h-28 text-base font-black', inner: 'w-[52px] h-[52px]', frame: 'w-[114px] h-[114px]' },
    9: { container: 'w-[118px] h-28 text-base font-black', inner: 'w-[52px] h-[52px]', frame: 'w-[117px] h-[117px]' },
    10: { container: 'w-[138px] h-28 text-sm font-black', inner: 'w-[42px] h-[42px]', frame: 'w-[138px] h-[138px]' },
  },
  '2xl': {
    1: { container: 'w-36 h-36 text-3xl font-black', inner: 'w-[98px] h-[98px]', frame: 'w-[129px] h-[129px]' },
    2: { container: 'w-36 h-36 text-3xl font-black', inner: 'w-[94px] h-[94px]', frame: 'w-[136px] h-[136px]' },
    3: { container: 'w-36 h-36 text-2xl font-black', inner: 'w-[90px] h-[90px]', frame: 'w-[137px] h-[137px]' },
    4: { container: 'w-36 h-36 text-2xl font-black', inner: 'w-[90px] h-[90px]', frame: 'w-[137px] h-[137px]' },
    5: { container: 'w-36 h-36 text-2xl font-black', inner: 'w-[82px] h-[82px]', frame: 'w-[141px] h-[141px]' },
    6: { container: 'w-36 h-36 text-xl font-black', inner: 'w-[76px] h-[76px]', frame: 'w-[143px] h-[143px]' },
    7: { container: 'w-36 h-36 text-xl font-black', inner: 'w-[74px] h-[74px]', frame: 'w-36 h-36' },
    8: { container: 'w-[146px] h-36 text-lg font-black', inner: 'w-[66px] h-[66px]', frame: 'w-[145px] h-[145px]' },
    9: { container: 'w-[148px] h-36 text-lg font-black', inner: 'w-[66px] h-[66px]', frame: 'w-[148px] h-[148px]' },
    10: { container: 'w-[178px] h-36 text-base font-black', inner: 'w-[54px] h-[54px]', frame: 'w-[178px] h-[178px]' },
  },
};

export interface FrameInfoItem {
  id: AchievementFrame;
  name: { ar: string; 'en-GB': string; 'en-US': string };
  desc: { ar: string; 'en-GB': string; 'en-US': string };
  tierLabel: { ar: string; 'en-GB': string; 'en-US': string };
  tierNumber: number;
  themeColor: string;
  bgClass: string;
  badgeBg: string;
  icon: AppIconName;
  iconColor: string;
}

export const LUXURY_AVATAR_PALETTE = [
  '#17375E', // Sapphire
  '#0F2A4A', // Navy
  '#5F7083', // Steel Grey
];

const ALLOWED_LUXURY_HEX_SET = new Set([
  '#17375e',
  '#0f2a4a',
  '#5f7083',
  '#e1ebec',
  '#ffffff',
]);

const AVATAR_BG_CLASS_MAP: Record<string, string> = {
  '#17375E': 'bg-[#17375E]',
  '#0F2A4A': 'bg-[#0F2A4A]',
  '#5F7083': 'bg-[#5F7083]',
  '#E1EBEC': 'bg-[#E1EBEC]',
  '#FFFFFF': 'bg-[#FFFFFF]',
};

export function normalizeLuxuryColor(color?: string | null, fallback: string = '#17375E'): string {
  if (!color || typeof color !== 'string') return fallback;
  const clean = color.trim().toLowerCase();
  if (clean === 'navy') return '#0F2A4A';
  if (clean === 'teal') return '#17375E';
  if (clean === 'slate') return '#5F7083';
  if (ALLOWED_LUXURY_HEX_SET.has(clean)) {
    return color.trim().toUpperCase();
  }
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % LUXURY_AVATAR_PALETTE.length;
  }
  return LUXURY_AVATAR_PALETTE[Math.abs(hash) % LUXURY_AVATAR_PALETTE.length];
}

function buildLevelFrameInfo(
  id: AchievementFrame,
  level: StudentProgressionLevel
): FrameInfoItem {
  const def = LEVEL_FRAME_DEFINITIONS[level];
  const icon: AppIconName =
    level >= 10
      ? 'crown'
      : level >= 8
      ? 'sparkles'
      : level >= 6
      ? 'gem'
      : level >= 4
      ? 'medal'
      : 'award';
  const badgeBg =
    level >= 8
      ? 'bg-gradient-to-tr from-sky-700 to-amber-400 text-white shadow-sm'
      : level >= 6
      ? 'bg-gradient-to-tr from-purple-700 to-amber-400 text-white shadow-sm'
      : 'bg-gradient-to-tr from-amber-700 to-yellow-400 text-white shadow-sm';

  return {
    id,
    name: { ar: def.titleAr, 'en-GB': def.titleEn, 'en-US': def.titleEn },
    desc: { ar: def.descAr, 'en-GB': def.descEn, 'en-US': def.descEn },
    tierLabel: { ar: def.shortLabelAr, 'en-GB': def.shortLabelEn, 'en-US': def.shortLabelEn },
    tierNumber: level,
    themeColor: def.accentHex,
    bgClass: 'ring-[#F59E0B]',
    badgeBg,
    icon,
    iconColor: 'text-white',
  };
}

const AUTO_FRAME_INFO: FrameInfoItem = {
  id: 'auto',
  name: {
    ar: 'تلقائي حسب المستوى والسلوك',
    'en-GB': 'Auto by Level & Behavior',
    'en-US': 'Auto by Level & Behavior',
  },
  desc: {
    ar: 'يبدأ من المستوى 1 ويتطور تلقائيًا حتى المستوى MAX حسب الحضور والسلوك والواجبات',
    'en-GB': 'Starts at Level 1 and progresses automatically to Level MAX based on attendance & behavior',
    'en-US': 'Starts at Level 1 and progresses automatically to Level MAX based on attendance & behavior',
  },
  tierLabel: { ar: 'تلقائي ذكي', 'en-GB': 'Auto Level', 'en-US': 'Auto Level' },
  tierNumber: 0,
  themeColor: '#D97706',
  bgClass: 'ring-[#F59E0B]',
  badgeBg: 'bg-navy text-white shadow-sm',
  icon: 'sparkles',
  iconColor: 'text-white',
};

export const ACHIEVEMENT_FRAME_INFO: Record<AchievementFrame, FrameInfoItem> = {
  auto: AUTO_FRAME_INFO,
  none: { ...AUTO_FRAME_INFO, id: 'none' },
  default: { ...AUTO_FRAME_INFO, id: 'default' },
  level_1: buildLevelFrameInfo('level_1', 1),
  level_2: buildLevelFrameInfo('level_2', 2),
  level_3: buildLevelFrameInfo('level_3', 3),
  level_4: buildLevelFrameInfo('level_4', 4),
  level_5: buildLevelFrameInfo('level_5', 5),
  level_6: buildLevelFrameInfo('level_6', 6),
  level_7: buildLevelFrameInfo('level_7', 7),
  level_8: buildLevelFrameInfo('level_8', 8),
  level_9: buildLevelFrameInfo('level_9', 9),
  level_10: buildLevelFrameInfo('level_10', 10),
  level_max: buildLevelFrameInfo('level_max', 10),
  // Legacy frame aliases mapped cleanly to corresponding custom uploaded levels
  silver: buildLevelFrameInfo('silver', 2),
  silver_scholar: buildLevelFrameInfo('silver_scholar', 2),
  bronze_star: buildLevelFrameInfo('bronze_star', 3),
  gold: buildLevelFrameInfo('gold', 4),
  gold_champion: buildLevelFrameInfo('gold_champion', 4),
  story: buildLevelFrameInfo('story', 5),
  diamond_elite: buildLevelFrameInfo('diamond_elite', 5),
  platinum: buildLevelFrameInfo('platinum', 6),
  nature: buildLevelFrameInfo('nature', 7),
  emerald_honor: buildLevelFrameInfo('emerald_honor', 7),
  challenge: buildLevelFrameInfo('challenge', 8),
  cosmic: buildLevelFrameInfo('cosmic', 9),
  star: buildLevelFrameInfo('star', 9),
  vip: buildLevelFrameInfo('vip', 10),
  crown: buildLevelFrameInfo('crown', 10),
  champion: buildLevelFrameInfo('champion', 10),
};

function resolveEffectiveAvatarFrame(
  student?: StudentAvatarProps['student'],
  propFrame?: AchievementFrame | null
): LevelFrameId {
  // If caller passed both student and achievementFrame={student.achievementFrame} while student is in 'auto' mode,
  // defer to student's auto progression rather than treating propFrame as a manual override.
  const effectivePropFrame =
    student && student.avatarFrameMode === 'auto' && propFrame === student.achievementFrame
      ? undefined
      : propFrame;
  return resolveStudentLevelFrame(student, effectivePropFrame);
}

function areStudentAvatarPropsEqual(
  prev: StudentAvatarProps,
  next: StudentAvatarProps
): boolean {
  const prevResolved =
    prev.showFrame === false
      ? 'none'
      : resolveEffectiveAvatarFrame(prev.student, prev.achievementFrame);
  const nextResolved =
    next.showFrame === false
      ? 'none'
      : resolveEffectiveAvatarFrame(next.student, next.achievementFrame);

  return (
    prevResolved === nextResolved &&
    prev.student?.id === next.student?.id &&
    prev.student?.name === next.student?.name &&
    prev.student?.avatarColor === next.student?.avatarColor &&
    prev.student?.profilePhoto === next.student?.profilePhoto &&
    prev.student?.achievementFrame === next.student?.achievementFrame &&
    prev.student?.avatarFrameMode === next.student?.avatarFrameMode &&
    prev.name === next.name &&
    prev.avatarColor === next.avatarColor &&
    prev.profilePhoto === next.profilePhoto &&
    prev.achievementFrame === next.achievementFrame &&
    prev.size === next.size &&
    prev.className === next.className &&
    prev.showBadge === next.showBadge &&
    prev.showFrame === next.showFrame
  );
}

const StudentAvatarInner: React.FC<StudentAvatarProps> = ({
  student,
  name: propName,
  avatarColor: propColor,
  profilePhoto: propPhoto,
  achievementFrame: propFrame,
  size = 'md',
  className = '',
  showBadge = false,
  showFrame = true,
}) => {
  const { language: currentLang } = useTranslation();
  const isEn = currentLang.startsWith('en');

  const finalName = student?.name || propName || (isEn ? 'Student' : 'طالب');
  const finalColor = normalizeLuxuryColor(student?.avatarColor || propColor, '#17375E');
  const isLightAvatarBg = finalColor === '#FFFFFF' || finalColor === '#E1EBEC';
  const finalPhoto = student?.profilePhoto !== undefined ? student?.profilePhoto : propPhoto;

  const resolvedLevelFrame: LevelFrameId = resolveEffectiveAvatarFrame(student, propFrame);
  const resolvedLevel = frameIdToLevel(resolvedLevelFrame);
  const hasFrame = showFrame !== false;
  const frameInfo = hasFrame ? ACHIEVEMENT_FRAME_INFO[resolvedLevelFrame] : null;

  const sizeKey: AvatarSizeKey =
    size === 'xs' ||
    size === 'sm' ||
    size === 'md' ||
    size === 'lg' ||
    size === 'xl' ||
    size === '2xl'
      ? size
      : 'md';
  const framedGeo = FRAMED_GEOMETRY[sizeKey][resolvedLevel];
  const noFrameContainerClass = NO_FRAME_CONTAINER_BY_SIZE[sizeKey];
  const badgeConfig = BADGE_CONFIG_BY_SIZE[sizeKey];

  const initial = finalName.trim() ? finalName.trim().charAt(0).toUpperCase() : isEn ? 'S' : 'ط';

  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [finalPhoto]);

  const hasPhoto = Boolean(
    !imgError &&
      finalPhoto &&
      typeof finalPhoto === 'string' &&
      finalPhoto.trim().length > 10 &&
      (finalPhoto.startsWith('data:image') ||
        finalPhoto.startsWith('http') ||
        finalPhoto.startsWith('blob:') ||
        finalPhoto.startsWith('/'))
  );

  const bgTailwindClass = hasPhoto
    ? 'bg-[#E1EBEC]'
    : AVATAR_BG_CLASS_MAP[finalColor] || 'bg-[#17375E]';

  const langKey = currentLang === 'en-GB' || currentLang === 'en-US' ? currentLang : 'ar';
  const frameTitle = frameInfo ? frameInfo.name[langKey] || frameInfo.name.ar : '';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        hasFrame
          ? `${framedGeo.container} gaming-frame-root frame-${resolvedLevelFrame}`
          : noFrameContainerClass
      } ${className}`}
    >
      {/* Core Circular Student Photo / Initial */}
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center gaming-frame-avatar-inner ${bgTailwindClass} ${
          isLightAvatarBg ? 'text-[#0F2A4A]' : 'text-[#FFFFFF]'
        } font-bold select-none relative z-0 ${
          hasFrame ? framedGeo.inner : 'w-full h-full shadow-sm'
        }`}
      >
        {hasPhoto ? (
          <img
            src={finalPhoto!}
            alt={finalName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-full pointer-events-none"
            loading="lazy"
            onError={() => {
              setImgError(true);
            }}
          />
        ) : (
          <span className="drop-shadow-xs select-none leading-none">{initial}</span>
        )}
      </div>

      {/* Custom Uploaded Golden Level-Up Frame Overlay (Level 1 -> Level MAX) */}
      {hasFrame && (
        <div
          className={`absolute pointer-events-none z-10 flex items-center justify-center ${framedGeo.frame}`}
        >
          <AchievementFrameSVG frame={resolvedLevelFrame} altText={frameTitle} />
        </div>
      )}

      {/* Optional Top Badge Icon */}
      {showBadge && frameInfo && (
        <div
          className={`absolute ${badgeConfig.badge} rounded-full flex items-center justify-center ${frameInfo.badgeBg} z-20 animate-in zoom-in duration-150 motion-reduce:animate-none`}
          title={frameTitle}
        >
          <AppIcon name={frameInfo.icon} weight="fill" className={badgeConfig.iconSize} />
        </div>
      )}
    </div>
  );
};

export const StudentAvatar = React.memo(StudentAvatarInner, areStudentAvatarPropsEqual);
