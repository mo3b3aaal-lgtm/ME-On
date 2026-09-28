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

export const ACHIEVEMENT_FRAME_INFO: Record<AchievementFrame, FrameInfoItem> = {
  none: {
    id: 'none',
    name: { ar: 'بدون إطار', 'en-GB': 'No Frame', 'en-US': 'No Frame' },
    desc: { ar: 'المظهر الافتراضي البسيط بدون مؤثرات', 'en-GB': 'Default clean circular avatar', 'en-US': 'Default clean circular avatar' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#74778F',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#74778F]',
  },
  default: {
    id: 'default',
    name: { ar: 'بدون إطار', 'en-GB': 'Default', 'en-US': 'Default' },
    desc: { ar: 'المظهر الافتراضي البسيط', 'en-GB': 'Default simple appearance', 'en-US': 'Default simple appearance' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#74778F',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#74778F]',
  },
  bronze_star: {
    id: 'bronze_star',
    name: { ar: 'نجمة البرونز الأكاديمية (Bronze Star)', 'en-GB': 'Bronze Star', 'en-US': 'Bronze Star' },
    desc: { ar: 'إطار برونزي عتيق مع نجمة ثلاثية الأبعاد ونقوش تروس معدنية متألقة', 'en-GB': 'Antique bronze metallic frame with 3D star and intricate geared rivets', 'en-US': 'Antique bronze metallic frame with 3D star and intricate geared rivets' },
    tierLabel: { ar: 'مستوى برونزي Tier I', 'en-GB': 'Bronze Tier I', 'en-US': 'Bronze Tier I' },
    tierNumber: 1,
    themeColor: '#CD7F32',
    bgClass: 'ring-[#CD7F32]/50',
    badgeBg: 'bg-gradient-to-tr from-[#9C5A20] to-[#CD7F32] text-white shadow-md ring-1 ring-[#CD7F32]/30',
    icon: Star,
    iconColor: 'text-[#CD7F32]',
  },
  silver_scholar: {
    id: 'silver_scholar',
    name: { ar: 'طالب الفضة المتميز (Silver Scholar)', 'en-GB': 'Silver Scholar', 'en-US': 'Silver Scholar' },
    desc: { ar: 'إطار فضي مصقول عاكس مع درع التميز وجناحي الصقر المتألقين', 'en-GB': 'Mirror-polished silver frame with academic heraldic shield and radiant falcon wings', 'en-US': 'Mirror-polished silver frame with academic heraldic shield and radiant falcon wings' },
    tierLabel: { ar: 'مستوى فضي Tier II', 'en-GB': 'Silver Tier II', 'en-US': 'Silver Tier II' },
    tierNumber: 2,
    themeColor: '#94A3B8',
    bgClass: 'ring-slate-300',
    badgeBg: 'bg-gradient-to-tr from-[#64748B] to-[#CBD5E1] text-[#1E293B] shadow-md ring-1 ring-white/50',
    icon: Shield,
    iconColor: 'text-slate-600',
  },
  gold_champion: {
    id: 'gold_champion',
    name: { ar: 'بطل الذهب الملكي (Gold Champion)', 'en-GB': 'Gold Champion', 'en-US': 'Gold Champion' },
    desc: { ar: 'إطار ذهبي عيار 24 مع أوراق الغار الإغريقية وأحجار التوباز والياقوت الأحمر', 'en-GB': '24K gold laurel wreath frame with embedded rubies and topazes', 'en-US': '24K gold laurel wreath frame with embedded rubies and topazes' },
    tierLabel: { ar: 'مستوى ذهبي Tier III', 'en-GB': 'Gold Tier III', 'en-US': 'Gold Tier III' },
    tierNumber: 3,
    themeColor: '#EAB308',
    bgClass: 'ring-yellow-400/60',
    badgeBg: 'bg-gradient-to-tr from-[#CA8A04] to-[#FDE047] text-[#713F12] shadow-lg ring-1 ring-white',
    icon: Award,
    iconColor: 'text-yellow-600',
  },
  platinum: {
    id: 'platinum',
    name: { ar: 'نخبة البلاتين الصاعقة (Platinum Elite)', 'en-GB': 'Platinum Elite', 'en-US': 'Platinum Elite' },
    desc: { ar: 'بلاتين مشع فائق النقاوة مع شفرات بلورية مائلة وأحجار الزفير الأزرق السماوي', 'en-GB': 'Luminous ultra-pure platinum frame with crystalline blades and sapphire gems', 'en-US': 'Luminous ultra-pure platinum frame with crystalline blades and sapphire gems' },
    tierLabel: { ar: 'مستوى بلاتيني Tier IV', 'en-GB': 'Platinum Tier IV', 'en-US': 'Platinum Tier IV' },
    tierNumber: 4,
    themeColor: '#7657F6',
    bgClass: 'ring-[#7657F6]/50',
    badgeBg: 'bg-gradient-to-tr from-[#403B9C] to-[#7657F6] text-white shadow-lg ring-1 ring-white',
    icon: Award,
    iconColor: 'text-[#7657F6]',
  },
  emerald_honor: {
    id: 'emerald_honor',
    name: { ar: 'شرف الزمرد الإمبراطوري (Emerald Honor)', 'en-GB': 'Emerald Honor', 'en-US': 'Emerald Honor' },
    desc: { ar: 'إطار زمردي ملكي مستوحى من التيجان السلتية مع أحجار زمرد كولومبي متوهجة', 'en-GB': 'Imperial Colombian emerald crown frame with deep Celtic gold lattice', 'en-US': 'Imperial Colombian emerald crown frame with deep Celtic gold lattice' },
    tierLabel: { ar: 'مستوى شرف الزمرد Tier V', 'en-GB': 'Emerald Tier V', 'en-US': 'Emerald Tier V' },
    tierNumber: 5,
    themeColor: '#059669',
    bgClass: 'ring-emerald-500/50',
    badgeBg: 'bg-gradient-to-tr from-[#065F46] to-[#10B981] text-white shadow-lg ring-1 ring-white',
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
  gold: {
    id: 'gold',
    name: { ar: 'بطل الذهب (Gold)', 'en-GB': 'Gold Champion', 'en-US': 'Gold Champion' },
    desc: { ar: 'إطار ذهبي متألق', 'en-GB': 'Radiant gold champion frame', 'en-US': 'Radiant gold champion frame' },
    tierLabel: { ar: 'مستوى ذهبي', 'en-GB': 'Gold Tier', 'en-US': 'Gold Tier' },
    tierNumber: 3,
    themeColor: '#EAB308',
    bgClass: 'ring-yellow-400',
    badgeBg: 'bg-yellow-500 text-white',
    icon: Award,
    iconColor: 'text-yellow-600',
  },
  silver: {
    id: 'silver',
    name: { ar: 'طالب الفضة (Silver)', 'en-GB': 'Silver Scholar', 'en-US': 'Silver Scholar' },
    desc: { ar: 'إطار فضي أنيق', 'en-GB': 'Elegant silver frame', 'en-US': 'Elegant silver frame' },
    tierLabel: { ar: 'مستوى فضي', 'en-GB': 'Silver Tier', 'en-US': 'Silver Tier' },
    tierNumber: 2,
    themeColor: '#94A3B8',
    bgClass: 'ring-slate-300',
    badgeBg: 'bg-slate-500 text-white',
    icon: Shield,
    iconColor: 'text-slate-600',
  },
  star: {
    id: 'star',
    name: { ar: 'نجمة الإبداع (Star)', 'en-GB': 'Star Performer', 'en-US': 'Star Performer' },
    desc: { ar: 'إطار النجمة المتألقة', 'en-GB': 'Radiant star frame', 'en-US': 'Radiant star frame' },
    tierLabel: { ar: 'مستوى النجمة', 'en-GB': 'Star Tier', 'en-US': 'Star Tier' },
    tierNumber: 1,
    themeColor: '#CD7F32',
    bgClass: 'ring-[#CD7F32]',
    badgeBg: 'bg-[#CD7F32] text-white',
    icon: Star,
    iconColor: 'text-[#CD7F32]',
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
  const finalColor = student?.avatarColor || propColor || '#7657F6';
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
        className={`rounded-full overflow-hidden flex items-center justify-center text-white font-bold select-none relative shadow-inner z-0 ${
          hasFrame ? `${sizeConfig.photoFramed} ring-1 ring-black/20` : 'w-full h-full shadow-sm'
        }`}
        style={{ backgroundColor: hasPhoto ? '#E8E7FF' : finalColor }}
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
