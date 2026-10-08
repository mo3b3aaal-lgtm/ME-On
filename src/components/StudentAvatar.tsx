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
  '#293828', // Sapphire
  '#0F1206', // Navy
  '#756046', // Steel Grey
];

const ALLOWED_LUXURY_HEX_SET = new Set([
  '#293828',
  '#0F1206'.toLowerCase(),
  '#756046',
  '#DDD3C7',
  '#F8F2EC',
]);

export function normalizeLuxuryColor(color?: string | null, fallback: string = '#293828'): string {
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
    themeColor: '#756046',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#756046]',
  },
  default: {
    id: 'default',
    name: { ar: 'بدون إطار', 'en-GB': 'Default', 'en-US': 'Default' },
    desc: { ar: 'المظهر الافتراضي البسيط', 'en-GB': 'Default simple appearance', 'en-US': 'Default simple appearance' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#756046',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#756046]',
  },
  bronze_star: {
    id: 'bronze_star',
    name: { ar: 'نجمة الياقوت الأزرق (Sapphire Star)', 'en-GB': 'Sapphire Star', 'en-US': 'Sapphire Star' },
    desc: { ar: 'إطار أكاديمي فاخر مع نجمة ثلاثية الأبعاد ونقوش معدنية مصقولة', 'en-GB': 'Sapphire & silver metallic frame with 3D star and precision rivets', 'en-US': 'Sapphire & silver metallic frame with 3D star and precision rivets' },
    tierLabel: { ar: 'مستوى أول Tier I', 'en-GB': 'Sapphire Tier I', 'en-US': 'Sapphire Tier I' },
    tierNumber: 1,
    themeColor: '#756046',
    bgClass: 'ring-[#DDD3C7]',
    badgeBg: 'bg-gradient-to-tr from-[#0F1206] to-[#756046] text-[#F8F2EC] shadow-md ring-1 ring-[#DDD3C7]/60',
    icon: Star,
    iconColor: 'text-[#F8F2EC]',
  },
  silver_scholar: {
    id: 'silver_scholar',
    name: { ar: 'طالب الفضة المتميز (Silver Scholar)', 'en-GB': 'Silver Scholar', 'en-US': 'Silver Scholar' },
    desc: { ar: 'إطار فضي مصقول مع درع التميز وجناحي الصقر المتألقين', 'en-GB': 'Polished silver & steel frame with academic heraldic shield and falcon wings', 'en-US': 'Polished silver & steel frame with academic heraldic shield and falcon wings' },
    tierLabel: { ar: 'مستوى ثانٍ Tier II', 'en-GB': 'Scholar Tier II', 'en-US': 'Scholar Tier II' },
    tierNumber: 2,
    themeColor: '#DDD3C7',
    bgClass: 'ring-[#DDD3C7]',
    badgeBg: 'bg-gradient-to-tr from-[#756046] to-[#293828] text-[#F8F2EC] shadow-md ring-1 ring-[#F8F2EC]/60',
    icon: Shield,
    iconColor: 'text-[#F8F2EC]',
  },
  gold_champion: {
    id: 'gold_champion',
    name: { ar: 'بطل السافير الملكي (Royal Sapphire)', 'en-GB': 'Royal Sapphire', 'en-US': 'Royal Sapphire' },
    desc: { ar: 'إطار ملكي مع أوراق الغار الإغريقية وأحجار الياقوت الأزرق', 'en-GB': 'Royal sapphire laurel wreath frame with embedded navy gems', 'en-US': 'Royal sapphire laurel wreath frame with embedded navy gems' },
    tierLabel: { ar: 'مستوى ثالث Tier III', 'en-GB': 'Royal Tier III', 'en-US': 'Royal Tier III' },
    tierNumber: 3,
    themeColor: '#293828',
    bgClass: 'ring-[#293828]/50',
    badgeBg: 'bg-gradient-to-tr from-[#0F1206] to-[#293828] text-[#F8F2EC] shadow-lg ring-1 ring-[#F8F2EC]',
    icon: Award,
    iconColor: 'text-[#F8F2EC]',
  },
  platinum: {
    id: 'platinum',
    name: { ar: 'نخبة البلاتين الفاخرة (Platinum Elite)', 'en-GB': 'Platinum Elite', 'en-US': 'Platinum Elite' },
    desc: { ar: 'إطار بلاتيني مشع فائق النقاوة مع شفرات بلورية وأحجار السافير', 'en-GB': 'Luminous silver-platinum frame with crystalline blades and sapphire gems', 'en-US': 'Luminous silver-platinum frame with crystalline blades and sapphire gems' },
    tierLabel: { ar: 'مستوى رابع Tier IV', 'en-GB': 'Elite Tier IV', 'en-US': 'Elite Tier IV' },
    tierNumber: 4,
    themeColor: '#293828',
    bgClass: 'ring-[#293828]/50',
    badgeBg: 'bg-gradient-to-tr from-[#0F1206] to-[#293828] text-[#F8F2EC] shadow-lg ring-1 ring-[#F8F2EC]',
    icon: Award,
    iconColor: 'text-[#F8F2EC]',
  },
  emerald_honor: {
    id: 'emerald_honor',
    name: { ar: 'شرف البحرية الإمبراطورية (Navy Honor)', 'en-GB': 'Navy Honor', 'en-US': 'Navy Honor' },
    desc: { ar: 'إطار ملكي مستوحى من التيجان الكلاسيكية مع أحجار الياقوت الأزرق', 'en-GB': 'Imperial navy & silver crown frame with classic filigree', 'en-US': 'Imperial navy & silver crown frame with classic filigree' },
    tierLabel: { ar: 'مستوى خامس Tier V', 'en-GB': 'Honor Tier V', 'en-US': 'Honor Tier V' },
    tierNumber: 5,
    themeColor: '#0F1206',
    bgClass: 'ring-[#0F1206]/50',
    badgeBg: 'bg-gradient-to-tr from-[#0F1206] to-[#293828] text-[#F8F2EC] shadow-lg ring-1 ring-[#F8F2EC]',
    icon: Gem,
    iconColor: 'text-[#F8F2EC]',
  },
  diamond_elite: {
    id: 'diamond_elite',
    name: { ar: 'نخبة الألماس والسافير (Diamond Sapphire)', 'en-GB': 'Diamond Sapphire', 'en-US': 'Diamond Sapphire' },
    desc: { ar: 'شظايا بلورية متوهجة مع نجمة سافير ثمانية الأضلاع', 'en-GB': 'Radiant white & silver prism cluster with 8-point sapphire star', 'en-US': 'Radiant white & silver prism cluster with 8-point sapphire star' },
    tierLabel: { ar: 'مستوى سادس Tier VI', 'en-GB': 'Diamond Tier VI', 'en-US': 'Diamond Tier VI' },
    tierNumber: 6,
    themeColor: '#293828',
    bgClass: 'ring-[#293828]/50',
    badgeBg: 'bg-gradient-to-tr from-[#756046] to-[#293828] text-[#F8F2EC] shadow-lg ring-1 ring-[#F8F2EC]',
    icon: Sparkles,
    iconColor: 'text-[#F8F2EC]',
  },
  crown: {
    id: 'crown',
    name: { ar: 'التاج الملكي الإمبراطوري (Imperial Crown)', 'en-GB': 'Imperial Crown', 'en-US': 'Imperial Crown' },
    desc: { ar: 'تاج ملكي شاهق خماسي القمم مرصع باللؤلؤ الأبيض والياقوت الأزرق', 'en-GB': 'Grand 5-peak Imperial silver crown with white pearls and sapphire gems', 'en-US': 'Grand 5-peak Imperial silver crown with white pearls and sapphire gems' },
    tierLabel: { ar: 'المستوى الملكي Tier VII', 'en-GB': 'Royal Tier VII', 'en-US': 'Royal Tier VII' },
    tierNumber: 7,
    themeColor: '#293828',
    bgClass: 'ring-[#293828]/50',
    badgeBg: 'bg-gradient-to-tr from-[#0F1206] to-[#293828] text-[#F8F2EC] shadow-lg ring-1 ring-[#F8F2EC]',
    icon: Crown,
    iconColor: 'text-[#F8F2EC]',
  },
  champion: {
    id: 'champion',
    name: { ar: 'البطل الأسطوري (Sapphire Estate Legend)', 'en-GB': 'Legendary Champion', 'en-US': 'Legendary Champion' },
    desc: { ar: 'قمة الفخامة الكلاسيكية: أجنحة الفضة الملكية والياقوت الأزرق الفاخر', 'en-GB': 'The pinnacle luxury frame: royal silver wings & deep sapphire gems', 'en-US': 'The pinnacle luxury frame: royal silver wings & deep sapphire gems' },
    tierLabel: { ar: 'الرتبة الأسطورية Ultimate Legend', 'en-GB': 'Legendary Tier VIII', 'en-US': 'Legendary Tier VIII' },
    tierNumber: 8,
    themeColor: '#293828',
    bgClass: 'ring-[#293828]/60',
    badgeBg: 'bg-gradient-to-tr from-[#0F1206] via-[#293828] to-[#756046] text-[#F8F2EC] shadow-xl ring-2 ring-[#DDD3C7]',
    icon: Flame,
    iconColor: 'text-[#F8F2EC]',
  },
  gold: {
    id: 'gold',
    name: { ar: 'بطل السافير (Sapphire)', 'en-GB': 'Royal Sapphire', 'en-US': 'Royal Sapphire' },
    desc: { ar: 'إطار سافير متألق', 'en-GB': 'Radiant sapphire champion frame', 'en-US': 'Radiant sapphire champion frame' },
    tierLabel: { ar: 'مستوى سافير', 'en-GB': 'Sapphire Tier', 'en-US': 'Sapphire Tier' },
    tierNumber: 3,
    themeColor: '#293828',
    bgClass: 'ring-[#293828]',
    badgeBg: 'bg-[#293828] text-[#F8F2EC]',
    icon: Award,
    iconColor: 'text-[#F8F2EC]',
  },
  silver: {
    id: 'silver',
    name: { ar: 'طالب الفضة (Silver)', 'en-GB': 'Silver Scholar', 'en-US': 'Silver Scholar' },
    desc: { ar: 'إطار فضي أنيق', 'en-GB': 'Elegant silver frame', 'en-US': 'Elegant silver frame' },
    tierLabel: { ar: 'مستوى فضي', 'en-GB': 'Silver Tier', 'en-US': 'Silver Tier' },
    tierNumber: 2,
    themeColor: '#DDD3C7',
    bgClass: 'ring-[#DDD3C7]',
    badgeBg: 'bg-[#756046] text-[#F8F2EC]',
    icon: Shield,
    iconColor: 'text-[#F8F2EC]',
  },
  star: {
    id: 'star',
    name: { ar: 'نجمة الإبداع (Star)', 'en-GB': 'Star Performer', 'en-US': 'Star Performer' },
    desc: { ar: 'إطار النجمة المتألقة', 'en-GB': 'Radiant star frame', 'en-US': 'Radiant star frame' },
    tierLabel: { ar: 'مستوى النجمة', 'en-GB': 'Star Tier', 'en-US': 'Star Tier' },
    tierNumber: 1,
    themeColor: '#293828',
    bgClass: 'ring-[#293828]',
    badgeBg: 'bg-[#293828] text-[#F8F2EC]',
    icon: Star,
    iconColor: 'text-[#F8F2EC]',
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
  const finalColor = normalizeLuxuryColor(student?.avatarColor || propColor, '#293828');
  const isLightAvatarBg = finalColor === '#F8F2EC' || finalColor === '#DDD3C7';
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
        className={`rounded-full overflow-hidden flex items-center justify-center ${
          isLightAvatarBg ? 'text-[#0F1206]' : 'text-[#F8F2EC]'
        } font-bold select-none relative shadow-inner z-0 ${
          hasFrame ? `${sizeConfig.photoFramed} ring-1 ring-[#0F1206]/25` : 'w-full h-full shadow-sm'
        }`}
        style={{ backgroundColor: hasPhoto ? '#DDD3C7' : finalColor }}
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
