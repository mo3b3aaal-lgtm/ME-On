import React from 'react';
import { Crown, Star, Award, Sparkles, Shield, User, Flame, Gem } from 'lucide-react';
import { AchievementFrame } from '../types';
import { AchievementFrameSVG } from './AchievementFramesSVG';
import { getAppLanguage } from '../utils/i18n';

export interface StudentAvatarProps {
  student?: {
    id?: string;
    name?: string;
    avatarColor?: string;
    profilePhoto?: string | null;
    achievementFrame?: AchievementFrame | null;
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

const SIZE_CONFIGS = {
  xs: {
    noFrameContainer: 'w-7 h-7 text-[11px]',
    framedContainer: 'w-8 h-8 text-[9px]',
    photoFramed: 'w-[64%] h-[64%]',
    badge: 'w-3 h-3 -top-0.5 -right-0.5 text-[8px]',
    iconSize: 'w-2 h-2',
  },
  sm: {
    noFrameContainer: 'w-9 h-9 text-xs',
    framedContainer: 'w-11 h-11 text-xs',
    photoFramed: 'w-[64%] h-[64%]',
    badge: 'w-4 h-4 -top-1 -right-1 text-[9px]',
    iconSize: 'w-2.5 h-2.5',
  },
  md: {
    noFrameContainer: 'w-11 h-11 text-sm font-bold',
    framedContainer: 'w-14 h-14 text-sm font-bold',
    photoFramed: 'w-[64%] h-[64%]',
    badge: 'w-5 h-5 -top-1 -right-1 text-[10px]',
    iconSize: 'w-3 h-3',
  },
  lg: {
    noFrameContainer: 'w-14 h-14 text-base font-bold',
    framedContainer: 'w-20 h-20 text-lg font-bold',
    photoFramed: 'w-[64%] h-[64%]',
    badge: 'w-6 h-6 -top-1.5 -right-1.5 text-xs',
    iconSize: 'w-3.5 h-3.5',
  },
  xl: {
    noFrameContainer: 'w-20 h-20 text-xl font-bold',
    framedContainer: 'w-28 h-28 text-2xl font-black',
    photoFramed: 'w-[64%] h-[64%]',
    badge: 'w-7 h-7 -top-2 -right-2 text-xs',
    iconSize: 'w-4 h-4',
  },
  '2xl': {
    noFrameContainer: 'w-24 h-24 text-2xl font-black',
    framedContainer: 'w-36 h-36 text-3xl font-black',
    photoFramed: 'w-[64%] h-[64%]',
    badge: 'w-8 h-8 -top-2.5 -right-2.5 text-sm',
    iconSize: 'w-4.5 h-4.5',
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
  icon: React.ElementType;
  iconColor: string;
}

export const LUXURY_AVATAR_PALETTE = [
  '#6B1E2B', // Burgundy (Palette 01)
  '#B68A4C', // Bronze (Palette 01)
  '#B56B45', // Copper (Palette 02)
  '#5C4033', // Walnut (Palette 01)
  '#69493C', // Warm Walnut (Palette 02)
  '#2F2F2F', // Charcoal (Palette 02)
];

const ALLOWED_LUXURY_HEX_SET = new Set([
  '#6b1e2b',
  '#b68a4c',
  '#f8f2ea',
  '#5c4033',
  '#b6a89c',
  '#b56b45',
  '#69493c',
  '#eadbc7',
  '#faf7f2',
  '#2f2f2f',
]);

export function normalizeLuxuryColor(color?: string | null, fallback: string = '#6B1E2B'): string {
  if (!color || typeof color !== 'string') return fallback;
  const clean = color.trim().toLowerCase();
  if (ALLOWED_LUXURY_HEX_SET.has(clean)) {
    return color.trim().toUpperCase();
  }
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % LUXURY_AVATAR_PALETTE.length;
  }
  return LUXURY_AVATAR_PALETTE[Math.abs(hash) % LUXURY_AVATAR_PALETTE.length];
}

export const ACHIEVEMENT_FRAME_INFO: Record<AchievementFrame, FrameInfoItem> = {
  none: {
    id: 'none',
    name: { ar: 'بدون إطار', 'en-GB': 'No Frame', 'en-US': 'No Frame' },
    desc: { ar: 'المظهر الافتراضي البسيط بدون مؤثرات', 'en-GB': 'Default clean circular avatar', 'en-US': 'Default clean circular avatar' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#69493C',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#69493C]',
  },
  default: {
    id: 'default',
    name: { ar: 'بدون إطار', 'en-GB': 'Default', 'en-US': 'Default' },
    desc: { ar: 'المظهر الافتراضي البسيط', 'en-GB': 'Default simple appearance', 'en-US': 'Default simple appearance' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#69493C',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#69493C]',
  },
  bronze_star: {
    id: 'bronze_star',
    name: { ar: 'نجمة البرونز الأكاديمية (Bronze Star)', 'en-GB': 'Bronze Star', 'en-US': 'Bronze Star' },
    desc: { ar: 'إطار برونزي عتيق مع نجمة ثلاثية الأبعاد ونقوش تروس معدنية متألقة', 'en-GB': 'Antique bronze metallic frame with 3D star and intricate geared rivets', 'en-US': 'Antique bronze metallic frame with 3D star and intricate geared rivets' },
    tierLabel: { ar: 'مستوى برونزي Tier I', 'en-GB': 'Bronze Tier I', 'en-US': 'Bronze Tier I' },
    tierNumber: 1,
    themeColor: '#B68A4C',
    bgClass: 'ring-[#B68A4C]/50',
    badgeBg: 'bg-gradient-to-tr from-[#5C4033] to-[#B68A4C] text-[#FAF7F2] shadow-md ring-1 ring-[#B68A4C]/30',
    icon: Star,
    iconColor: 'text-[#B68A4C]',
  },
  silver_scholar: {
    id: 'silver_scholar',
    name: { ar: 'طالب الكشمير المتميز (Cashmere Scholar)', 'en-GB': 'Cashmere Scholar', 'en-US': 'Cashmere Scholar' },
    desc: { ar: 'إطار كشميري عاجي مصقول مع درع التميز وجناحي الصقر المتألقين', 'en-GB': 'Polished cashmere & taupe frame with academic heraldic shield and falcon wings', 'en-US': 'Polished cashmere & taupe frame with academic heraldic shield and falcon wings' },
    tierLabel: { ar: 'مستوى ثانٍ Tier II', 'en-GB': 'Scholar Tier II', 'en-US': 'Scholar Tier II' },
    tierNumber: 2,
    themeColor: '#B6A89C',
    bgClass: 'ring-[#B6A89C]',
    badgeBg: 'bg-gradient-to-tr from-[#69493C] to-[#B6A89C] text-[#FAF7F2] shadow-md ring-1 ring-[#FAF7F2]/50',
    icon: Shield,
    iconColor: 'text-[#5C4033]',
  },
  gold_champion: {
    id: 'gold_champion',
    name: { ar: 'بطل البرونز الملكي (Royal Bronze)', 'en-GB': 'Royal Bronze', 'en-US': 'Royal Bronze' },
    desc: { ar: 'إطار برونزي ملكي مع أوراق الغار الإغريقية وأحجار العقيق البرغندي', 'en-GB': 'Royal bronze laurel wreath frame with embedded burgundy garnets', 'en-US': 'Royal bronze laurel wreath frame with embedded burgundy garnets' },
    tierLabel: { ar: 'مستوى ثالث Tier III', 'en-GB': 'Royal Tier III', 'en-US': 'Royal Tier III' },
    tierNumber: 3,
    themeColor: '#B68A4C',
    bgClass: 'ring-[#B68A4C]/60',
    badgeBg: 'bg-gradient-to-tr from-[#B56B45] to-[#B68A4C] text-[#FAF7F2] shadow-lg ring-1 ring-[#FAF7F2]',
    icon: Award,
    iconColor: 'text-[#B68A4C]',
  },
  platinum: {
    id: 'platinum',
    name: { ar: 'نخبة الكشمير الفاخرة (Cashmere Elite)', 'en-GB': 'Cashmere Elite', 'en-US': 'Cashmere Elite' },
    desc: { ar: 'إطار كشميري مشع فائق النقاوة مع شفرات بلورية وأحجار النحاس الدافئة', 'en-GB': 'Luminous cashmere frame with crystalline blades and warm copper gems', 'en-US': 'Luminous cashmere frame with crystalline blades and warm copper gems' },
    tierLabel: { ar: 'مستوى رابع Tier IV', 'en-GB': 'Elite Tier IV', 'en-US': 'Elite Tier IV' },
    tierNumber: 4,
    themeColor: '#6B1E2B',
    bgClass: 'ring-[#6B1E2B]/50',
    badgeBg: 'bg-gradient-to-tr from-[#5C4033] to-[#6B1E2B] text-[#FAF7F2] shadow-lg ring-1 ring-[#FAF7F2]',
    icon: Award,
    iconColor: 'text-[#6B1E2B]',
  },
  emerald_honor: {
    id: 'emerald_honor',
    name: { ar: 'شرف الجوز الإمبراطوري (Walnut Honor)', 'en-GB': 'Walnut Honor', 'en-US': 'Walnut Honor' },
    desc: { ar: 'إطار ملكي دافئ مستوحى من التيجان الكلاسيكية مع أحجار البرونز المعتق', 'en-GB': 'Imperial walnut & antique bronze crown frame with classic filigree', 'en-US': 'Imperial walnut & antique bronze crown frame with classic filigree' },
    tierLabel: { ar: 'مستوى خامس Tier V', 'en-GB': 'Honor Tier V', 'en-US': 'Honor Tier V' },
    tierNumber: 5,
    themeColor: '#5C4033',
    bgClass: 'ring-[#5C4033]/50',
    badgeBg: 'bg-gradient-to-tr from-[#5C4033] to-[#B68A4C] text-[#FAF7F2] shadow-lg ring-1 ring-[#FAF7F2]',
    icon: Gem,
    iconColor: 'text-[#5C4033]',
  },
  diamond_elite: {
    id: 'diamond_elite',
    name: { ar: 'نخبة العاج والبرونز (Ivory Elite)', 'en-GB': 'Ivory Elite', 'en-US': 'Ivory Elite' },
    desc: { ar: 'شظايا بلورية عاجية متوهجة مع نجمة برونزية ثمانية الأضلاع', 'en-GB': 'Radiant ivory & sand prism cluster with 8-point bronze star', 'en-US': 'Radiant ivory & sand prism cluster with 8-point bronze star' },
    tierLabel: { ar: 'مستوى سادس Tier VI', 'en-GB': 'Ivory Tier VI', 'en-US': 'Ivory Tier VI' },
    tierNumber: 6,
    themeColor: '#B56B45',
    bgClass: 'ring-[#B56B45]/50',
    badgeBg: 'bg-gradient-to-tr from-[#69493C] to-[#B56B45] text-[#FAF7F2] shadow-lg ring-1 ring-[#FAF7F2]',
    icon: Sparkles,
    iconColor: 'text-[#B56B45]',
  },
  crown: {
    id: 'crown',
    name: { ar: 'التاج الملكي الإمبراطوري (Imperial Crown)', 'en-GB': 'Imperial Crown', 'en-US': 'Imperial Crown' },
    desc: { ar: 'تاج ملكي شاهق خماسي القمم مرصع باللؤلؤ العاجي والعقيق البرغندي', 'en-GB': 'Grand 5-peak Imperial bronze crown with ivory pearls and burgundy garnets', 'en-US': 'Grand 5-peak Imperial bronze crown with ivory pearls and burgundy garnets' },
    tierLabel: { ar: 'المستوى الملكي Tier VII', 'en-GB': 'Royal Tier VII', 'en-US': 'Royal Tier VII' },
    tierNumber: 7,
    themeColor: '#B56B45',
    bgClass: 'ring-[#B56B45]/50',
    badgeBg: 'bg-gradient-to-tr from-[#6B1E2B] to-[#B56B45] text-[#FAF7F2] shadow-lg ring-1 ring-[#FAF7F2]',
    icon: Crown,
    iconColor: 'text-[#B56B45]',
  },
  champion: {
    id: 'champion',
    name: { ar: 'البطل الأسطوري (Legendary Brocade)', 'en-GB': 'Legendary Champion', 'en-US': 'Legendary Champion' },
    desc: { ar: 'قمة الفخامة الكلاسيكية: أجنحة البرونز الملكي والياقوت البرغندي الفاخر', 'en-GB': 'The pinnacle luxury frame: antique bronze wings & deep burgundy rubies', 'en-US': 'The pinnacle luxury frame: antique bronze wings & deep burgundy rubies' },
    tierLabel: { ar: 'الرتبة الأسطورية Ultimate Legend', 'en-GB': 'Legendary Tier VIII', 'en-US': 'Legendary Tier VIII' },
    tierNumber: 8,
    themeColor: '#6B1E2B',
    bgClass: 'ring-[#6B1E2B]/60',
    badgeBg: 'bg-gradient-to-tr from-[#6B1E2B] via-[#B56B45] to-[#B68A4C] text-[#FAF7F2] shadow-xl ring-2 ring-[#EADBC7]',
    icon: Flame,
    iconColor: 'text-[#6B1E2B]',
  },
  gold: {
    id: 'gold',
    name: { ar: 'بطل البرونز (Bronze)', 'en-GB': 'Royal Bronze', 'en-US': 'Royal Bronze' },
    desc: { ar: 'إطار برونزي متألق', 'en-GB': 'Radiant bronze champion frame', 'en-US': 'Radiant bronze champion frame' },
    tierLabel: { ar: 'مستوى برونزي', 'en-GB': 'Bronze Tier', 'en-US': 'Bronze Tier' },
    tierNumber: 3,
    themeColor: '#B68A4C',
    bgClass: 'ring-[#B68A4C]',
    badgeBg: 'bg-[#B68A4C] text-[#FAF7F2]',
    icon: Award,
    iconColor: 'text-[#B68A4C]',
  },
  silver: {
    id: 'silver',
    name: { ar: 'طالب الكشمير (Cashmere)', 'en-GB': 'Cashmere Scholar', 'en-US': 'Cashmere Scholar' },
    desc: { ar: 'إطار كشميري أنيق', 'en-GB': 'Elegant cashmere frame', 'en-US': 'Elegant cashmere frame' },
    tierLabel: { ar: 'مستوى كشميري', 'en-GB': 'Cashmere Tier', 'en-US': 'Cashmere Tier' },
    tierNumber: 2,
    themeColor: '#B6A89C',
    bgClass: 'ring-[#B6A89C]',
    badgeBg: 'bg-[#69493C] text-[#FAF7F2]',
    icon: Shield,
    iconColor: 'text-[#5C4033]',
  },
  star: {
    id: 'star',
    name: { ar: 'نجمة الإبداع (Star)', 'en-GB': 'Star Performer', 'en-US': 'Star Performer' },
    desc: { ar: 'إطار النجمة المتألقة', 'en-GB': 'Radiant star frame', 'en-US': 'Radiant star frame' },
    tierLabel: { ar: 'مستوى النجمة', 'en-GB': 'Star Tier', 'en-US': 'Star Tier' },
    tierNumber: 1,
    themeColor: '#B56B45',
    bgClass: 'ring-[#B56B45]',
    badgeBg: 'bg-[#B56B45] text-[#FAF7F2]',
    icon: Star,
    iconColor: 'text-[#B56B45]',
  },
};

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
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
  const currentLang = getAppLanguage();
  const isEn = currentLang.startsWith('en');

  const finalName = student?.name || propName || (isEn ? 'Student' : 'طالب');
  const finalColor = normalizeLuxuryColor(student?.avatarColor || propColor, '#6B1E2B');
  const finalPhoto = student?.profilePhoto !== undefined ? student?.profilePhoto : propPhoto;
  const rawFrame = (student?.achievementFrame || propFrame || 'none') as AchievementFrame;

  const hasFrame = showFrame && rawFrame && rawFrame !== 'none' && rawFrame !== 'default';
  const frameInfo = hasFrame ? ACHIEVEMENT_FRAME_INFO[rawFrame] || ACHIEVEMENT_FRAME_INFO.gold_champion : null;
  const BadgeIcon = frameInfo ? frameInfo.icon : null;

  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const initial = finalName.trim() ? finalName.trim().charAt(0).toUpperCase() : (isEn ? 'S' : 'ط');

  const hasPhoto = Boolean(
    finalPhoto &&
      typeof finalPhoto === 'string' &&
      finalPhoto.trim().length > 10 &&
      (finalPhoto.startsWith('data:image') ||
        finalPhoto.startsWith('http') ||
        finalPhoto.startsWith('blob:') ||
        finalPhoto.startsWith('/'))
  );

  const frameTitle = frameInfo ? (frameInfo.name[currentLang] || frameInfo.name.ar) : '';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        hasFrame ? sizeConfig.framedContainer : sizeConfig.noFrameContainer
      } ${className}`}
    >
      {/* Core Avatar Photo / Initial Circle */}
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center text-[#FAF7F2] font-bold select-none relative shadow-inner z-0 ${
          hasFrame ? `${sizeConfig.photoFramed} ring-1 ring-[#5C4033]/25` : 'w-full h-full shadow-sm'
        }`}
        style={{ backgroundColor: hasPhoto ? '#EADBC7' : finalColor }}
      >
        {hasPhoto ? (
          <img
            src={finalPhoto!}
            alt={finalName}
            className="w-full h-full object-cover rounded-full pointer-events-none"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="drop-shadow-md select-none">{initial}</span>
        )}
      </div>

      {/* Luxury Gaming SVG Frame Overlay */}
      {hasFrame && (
        <div className="absolute inset-0 w-full h-full pointer-events-none z-10 flex items-center justify-center">
          <AchievementFrameSVG frame={rawFrame} />
        </div>
      )}

      {/* Optional Top Badge Icon */}
      {showBadge && frameInfo && BadgeIcon && (
        <div
          className={`absolute ${sizeConfig.badge} rounded-full flex items-center justify-center ${frameInfo.badgeBg} z-20 animate-in zoom-in duration-150`}
          title={frameTitle}
        >
          <BadgeIcon className={sizeConfig.iconSize} />
        </div>
      )}
    </div>
  );
};
