import React from 'react';
import { Crown, Star, Award, Sparkles, Shield, User, Flame, Gem } from 'lucide-react';
import { AchievementFrame } from '../types';
import { AchievementFrameSVG } from './AchievementFramesSVG';

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

export const ACHIEVEMENT_FRAME_INFO: Record<AchievementFrame, FrameInfoItem> = {
  none: {
    id: 'none',
    name: { ar: 'بدون إطار', 'en-GB': 'No Frame', 'en-US': 'No Frame' },
    desc: { ar: 'المظهر الافتراضي البسيط بدون مؤثرات', 'en-GB': 'Default clean circular avatar', 'en-US': 'Default clean circular avatar' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#8A9187',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#8A9187]',
  },
  default: {
    id: 'default',
    name: { ar: 'بدون إطار', 'en-GB': 'Default', 'en-US': 'Default' },
    desc: { ar: 'المظهر الافتراضي البسيط', 'en-GB': 'Default simple appearance', 'en-US': 'Default simple appearance' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#8A9187',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#8A9187]',
  },
  bronze_star: {
    id: 'bronze_star',
    name: { ar: 'النجمة البرونزية (Bronze Star)', 'en-GB': 'Bronze Star', 'en-US': 'Bronze Star' },
    desc: { ar: 'إطار برونزي معدني عتيق مع ترصيع نجمي وأجنحة قتالية', 'en-GB': 'Burnished bronze metallic armor with warrior star crest', 'en-US': 'Burnished bronze metallic armor with warrior star crest' },
    tierLabel: { ar: 'المستوى البرونزي Tier I', 'en-GB': 'Bronze Tier I', 'en-US': 'Bronze Tier I' },
    tierNumber: 1,
    themeColor: '#CD7F32',
    bgClass: 'ring-[#CD7F32]/40',
    badgeBg: 'bg-gradient-to-tr from-[#8C521F] to-[#CD7F32] text-white shadow-md',
    icon: Star,
    iconColor: 'text-[#CD7F32]',
  },
  star: {
    id: 'star',
    name: { ar: 'النجمة البرونزية (Bronze Star)', 'en-GB': 'Bronze Star', 'en-US': 'Bronze Star' },
    desc: { ar: 'إطار برونزي معدني عتيق مع ترصيع نجمي وأجنحة قتالية', 'en-GB': 'Burnished bronze metallic armor with warrior star crest', 'en-US': 'Burnished bronze metallic armor with warrior star crest' },
    tierLabel: { ar: 'المستوى البرونزي Tier I', 'en-GB': 'Bronze Tier I', 'en-US': 'Bronze Tier I' },
    tierNumber: 1,
    themeColor: '#CD7F32',
    bgClass: 'ring-[#CD7F32]/40',
    badgeBg: 'bg-gradient-to-tr from-[#8C521F] to-[#CD7F32] text-white shadow-md',
    icon: Star,
    iconColor: 'text-[#CD7F32]',
  },
  silver_scholar: {
    id: 'silver_scholar',
    name: { ar: 'الباحث الفضي (Silver Scholar)', 'en-GB': 'Silver Scholar', 'en-US': 'Silver Scholar' },
    desc: { ar: 'إطار فضي مصقول بأجنحة الغار وشعار الياقوت الأزرق', 'en-GB': 'Polished silver chrome filigree with sapphire scholar crest', 'en-US': 'Polished silver chrome filigree with sapphire scholar crest' },
    tierLabel: { ar: 'المستوى الفضي Tier II', 'en-GB': 'Silver Tier II', 'en-US': 'Silver Tier II' },
    tierNumber: 2,
    themeColor: '#94A3B8',
    bgClass: 'ring-[#94A3B8]/40',
    badgeBg: 'bg-gradient-to-tr from-[#64748B] to-[#94A3B8] text-white shadow-md',
    icon: Shield,
    iconColor: 'text-[#64748B]',
  },
  silver: {
    id: 'silver',
    name: { ar: 'الباحث الفضي (Silver Scholar)', 'en-GB': 'Silver Scholar', 'en-US': 'Silver Scholar' },
    desc: { ar: 'إطار فضي مصقول بأجنحة الغار وشعار الياقوت الأزرق', 'en-GB': 'Polished silver chrome filigree with sapphire scholar crest', 'en-US': 'Polished silver chrome filigree with sapphire scholar crest' },
    tierLabel: { ar: 'المستوى الفضي Tier II', 'en-GB': 'Silver Tier II', 'en-US': 'Silver Tier II' },
    tierNumber: 2,
    themeColor: '#94A3B8',
    bgClass: 'ring-[#94A3B8]/40',
    badgeBg: 'bg-gradient-to-tr from-[#64748B] to-[#94A3B8] text-white shadow-md',
    icon: Shield,
    iconColor: 'text-[#64748B]',
  },
  gold_champion: {
    id: 'gold_champion',
    name: { ar: 'البطل الذهبي (Gold Champion)', 'en-GB': 'Gold Champion', 'en-US': 'Gold Champion' },
    desc: { ar: 'إطار ذهب خالص 24 قيراط بأجنحة بطل الدفعة ونجمة الياقوت المتوهجة', 'en-GB': 'Rich 24K gold metallic armor with champion wings and glowing sunburst', 'en-US': 'Rich 24K gold metallic armor with champion wings and glowing sunburst' },
    tierLabel: { ar: 'المستوى الذهبي Tier III', 'en-GB': 'Gold Tier III', 'en-US': 'Gold Tier III' },
    tierNumber: 3,
    themeColor: '#F59E0B',
    bgClass: 'ring-[#F59E0B]/50',
    badgeBg: 'bg-gradient-to-tr from-[#B45309] to-[#F59E0B] text-white shadow-md ring-1 ring-white/50',
    icon: Crown,
    iconColor: 'text-[#B45309]',
  },
  gold: {
    id: 'gold',
    name: { ar: 'البطل الذهبي (Gold Champion)', 'en-GB': 'Gold Champion', 'en-US': 'Gold Champion' },
    desc: { ar: 'إطار ذهب خالص 24 قيراط بأجنحة بطل الدفعة ونجمة الياقوت المتوهجة', 'en-GB': 'Rich 24K gold metallic armor with champion wings and glowing sunburst', 'en-US': 'Rich 24K gold metallic armor with champion wings and glowing sunburst' },
    tierLabel: { ar: 'المستوى الذهبي Tier III', 'en-GB': 'Gold Tier III', 'en-US': 'Gold Tier III' },
    tierNumber: 3,
    themeColor: '#F59E0B',
    bgClass: 'ring-[#F59E0B]/50',
    badgeBg: 'bg-gradient-to-tr from-[#B45309] to-[#F59E0B] text-white shadow-md ring-1 ring-white/50',
    icon: Crown,
    iconColor: 'text-[#B45309]',
  },
  platinum: {
    id: 'platinum',
    name: { ar: 'البلاتينيوم النقي (Platinum Elite)', 'en-GB': 'Platinum Elite', 'en-US': 'Platinum Elite' },
    desc: { ar: 'فولاذ بلاتيني بلوري مع شفرات حادة وتوهج سماوي فائق النقاء', 'en-GB': 'Pure platinum-steel armor with sharp crystalline blades and celestial glow', 'en-US': 'Pure platinum-steel armor with sharp crystalline blades and celestial glow' },
    tierLabel: { ar: 'المستوى البلاتيني Tier IV', 'en-GB': 'Platinum Tier IV', 'en-US': 'Platinum Tier IV' },
    tierNumber: 4,
    themeColor: '#38BDF8',
    bgClass: 'ring-[#38BDF8]/40',
    badgeBg: 'bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] text-white shadow-md ring-1 ring-white/50',
    icon: Sparkles,
    iconColor: 'text-[#0284C7]',
  },
  emerald_honor: {
    id: 'emerald_honor',
    name: { ar: 'وسام الزمرد والقدوة (Emerald Honor)', 'en-GB': 'Emerald Honor', 'en-US': 'Emerald Honor' },
    desc: { ar: 'درع الزمرد الإمبراطوري المرصع بحراشف التنين والذهب الفاخر', 'en-GB': 'Imperial emerald gemstone ring with gold dragon claws and marquise jewel', 'en-US': 'Imperial emerald gemstone ring with gold dragon claws and marquise jewel' },
    tierLabel: { ar: 'مستوى وسام الزمرد Tier V', 'en-GB': 'Emerald Tier V', 'en-US': 'Emerald Tier V' },
    tierNumber: 5,
    themeColor: '#10B981',
    bgClass: 'ring-[#10B981]/40',
    badgeBg: 'bg-gradient-to-tr from-[#047857] to-[#10B981] text-white shadow-md',
    icon: Gem,
    iconColor: 'text-[#047857]',
  },
  diamond_elite: {
    id: 'diamond_elite',
    name: { ar: 'نخبة الماس الكونية (Diamond Elite)', 'en-GB': 'Diamond Elite', 'en-US': 'Diamond Elite' },
    desc: { ar: 'شظايا ألماسية منشورية متوهجة مع نجمة ماسية ثمانية الأضلاع', 'en-GB': 'Radiant diamond prism cluster with 8-point cosmic star and crystal shards', 'en-US': 'Radiant diamond prism cluster with 8-point cosmic star and crystal shards' },
    tierLabel: { ar: 'مستوى نخبة الماس Tier VI', 'en-GB': 'Diamond Tier VI', 'en-US': 'Diamond Tier VI' },
    tierNumber: 6,
    themeColor: '#0284C7',
    bgClass: 'ring-[#0284C7]/50',
    badgeBg: 'bg-gradient-to-tr from-[#0369A1] to-[#38BDF8] text-white shadow-lg ring-1 ring-white',
    icon: Sparkles,
    iconColor: 'text-[#0284C7]',
  },
  crown: {
    id: 'crown',
    name: { ar: 'التاج الملكي الإمبراطوري (Imperial Crown)', 'en-GB': 'Imperial Crown', 'en-US': 'Imperial Crown' },
    desc: { ar: 'تاج ملكي شاهق خماسي القمم مرصع باللؤلؤ والياقوت الأحمر والزركونيا', 'en-GB': 'Grand 5-peak Imperial gold crown with pearls, rubies and royal mantle', 'en-US': 'Grand 5-peak Imperial gold crown with pearls, rubies and royal mantle' },
    tierLabel: { ar: 'المستوى الملكي Tier VII', 'en-GB': 'Royal Tier VII', 'en-US': 'Royal Tier VII' },
    tierNumber: 7,
    themeColor: '#EA580C',
    bgClass: 'ring-[#EA580C]/50',
    badgeBg: 'bg-gradient-to-tr from-[#B45309] to-[#EA580C] text-white shadow-lg ring-1 ring-white',
    icon: Crown,
    iconColor: 'text-[#EA580C]',
  },
  champion: {
    id: 'champion',
    name: { ar: 'البطل الأسطوري (Legendary Champion)', 'en-GB': 'Legendary Champion', 'en-US': 'Legendary Champion' },
    desc: { ar: 'قمة الفخامة والأناقة في ألعاب الفانتازيا: أجنحة التنين الذهبية والياقوت القرمزي الناري', 'en-GB': 'The pinnacle luxury fantasy gaming frame: golden dragon wings & flaming crimson rubies', 'en-US': 'The pinnacle luxury fantasy gaming frame: golden dragon wings & flaming crimson rubies' },
    tierLabel: { ar: 'الرتبة الأسطورية Ultimate Legend', 'en-GB': 'Legendary Tier VIII', 'en-US': 'Legendary Tier VIII' },
    tierNumber: 8,
    themeColor: '#DC2626',
    bgClass: 'ring-[#DC2626]/60',
    badgeBg: 'bg-gradient-to-tr from-[#991B1B] via-[#DC2626] to-[#F59E0B] text-white shadow-xl ring-2 ring-yellow-300',
    icon: Flame,
    iconColor: 'text-[#DC2626]',
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
  const finalName = student?.name || propName || 'طالب';
  const finalColor = student?.avatarColor || propColor || '#748C70';
  const finalPhoto = student?.profilePhoto !== undefined ? student?.profilePhoto : propPhoto;
  const rawFrame = (student?.achievementFrame || propFrame || 'none') as AchievementFrame;

  const hasFrame = showFrame && rawFrame && rawFrame !== 'none' && rawFrame !== 'default';
  const frameInfo = hasFrame ? ACHIEVEMENT_FRAME_INFO[rawFrame] || ACHIEVEMENT_FRAME_INFO.gold_champion : null;
  const BadgeIcon = frameInfo ? frameInfo.icon : null;

  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  // Initial letter
  const initial = finalName.trim() ? finalName.trim().charAt(0).toUpperCase() : 'ط';

  const hasPhoto = Boolean(
    finalPhoto &&
      typeof finalPhoto === 'string' &&
      finalPhoto.trim().length > 10 &&
      (finalPhoto.startsWith('data:image') ||
        finalPhoto.startsWith('http') ||
        finalPhoto.startsWith('blob:') ||
        finalPhoto.startsWith('/'))
  );

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        hasFrame ? sizeConfig.framedContainer : sizeConfig.noFrameContainer
      } ${className}`}
    >
      {/* Core Avatar Photo / Initial Circle */}
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center text-white font-bold select-none relative shadow-inner z-0 ${
          hasFrame ? `${sizeConfig.photoFramed} ring-1 ring-black/20` : 'w-full h-full shadow-sm'
        }`}
        style={{ backgroundColor: hasPhoto ? '#E8E2D6' : finalColor }}
      >
        {hasPhoto ? (
          <img
            src={finalPhoto!}
            alt={finalName}
            className="w-full h-full object-cover rounded-full pointer-events-none"
            loading="lazy"
            onError={(e) => {
              // Fallback to initial if image fails
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
          title={frameInfo.name.ar}
        >
          <BadgeIcon className={sizeConfig.iconSize} />
        </div>
      )}
    </div>
  );
};

