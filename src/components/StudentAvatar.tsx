import React from 'react';
import { Crown, Star, Award, Sparkles, Shield, User } from 'lucide-react';
import { AchievementFrame } from '../types';

interface StudentAvatarProps {
  name: string;
  avatarColor?: string;
  profilePhoto?: string | null;
  achievementFrame?: AchievementFrame | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBadge?: boolean;
}

const SIZE_CONFIGS = {
  xs: {
    container: 'w-7 h-7 text-[11px]',
    framePadding: 'p-[1.5px]',
    badge: 'w-3 h-3 -top-1 -right-1 text-[8px]',
    iconSize: 'w-2 h-2',
    ring: 'ring-1',
  },
  sm: {
    container: 'w-9 h-9 text-xs',
    framePadding: 'p-[2px]',
    badge: 'w-4 h-4 -top-1.5 -right-1.5 text-[9px]',
    iconSize: 'w-2.5 h-2.5',
    ring: 'ring-1.5',
  },
  md: {
    container: 'w-11 h-11 text-sm',
    framePadding: 'p-[2.5px]',
    badge: 'w-5 h-5 -top-1.5 -right-1.5 text-[10px]',
    iconSize: 'w-3 h-3',
    ring: 'ring-2',
  },
  lg: {
    container: 'w-14 h-14 text-base font-bold',
    framePadding: 'p-[3px]',
    badge: 'w-6 h-6 -top-2 -right-2 text-xs',
    iconSize: 'w-3.5 h-3.5',
    ring: 'ring-2',
  },
  xl: {
    container: 'w-20 h-20 text-xl font-bold',
    framePadding: 'p-[3.5px]',
    badge: 'w-7 h-7 -top-2.5 -right-2.5 text-xs',
    iconSize: 'w-4 h-4',
    ring: 'ring-[2.5px]',
  },
  '2xl': {
    container: 'w-24 h-24 text-2xl font-black',
    framePadding: 'p-[4px]',
    badge: 'w-8 h-8 -top-3 -right-3 text-sm',
    iconSize: 'w-4.5 h-4.5',
    ring: 'ring-3',
  },
};

export const ACHIEVEMENT_FRAME_INFO: Record<
  AchievementFrame,
  {
    name: { ar: string; 'en-GB': string; 'en-US': string };
    desc: { ar: string; 'en-GB': string; 'en-US': string };
    borderClass: string;
    bgClass: string;
    badgeBg: string;
    icon: React.ElementType;
    iconColor: string;
  }
> = {
  none: {
    name: { ar: 'بدون إطار', 'en-GB': 'No Frame', 'en-US': 'No Frame' },
    desc: { ar: 'المظهر الافتراضي البسيط', 'en-GB': 'Default simple appearance', 'en-US': 'Default simple appearance' },
    borderClass: 'border-transparent',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#8A9187]',
  },
  gold: {
    name: { ar: 'إطار ذهبي متألق', 'en-GB': 'Gold Distinction', 'en-US': 'Gold Honor' },
    desc: { ar: 'للطلاب المتفوقين دراسياً', 'en-GB': 'For top academic performers', 'en-US': 'For top academic performers' },
    borderClass: 'bg-gradient-to-tr from-[#B38728] via-[#FBF5B7] to-[#DAA520] shadow-sm',
    bgClass: 'ring-[#D49B4B]/40',
    badgeBg: 'bg-gradient-to-tr from-[#B38728] to-[#DAA520] text-white shadow-xs',
    icon: Sparkles,
    iconColor: 'text-[#9C6615]',
  },
  silver: {
    name: { ar: 'إطار فضي مصقول', 'en-GB': 'Silver Merit', 'en-US': 'Silver Merit' },
    desc: { ar: 'للتميز في الالتزام والحضور', 'en-GB': 'For attendance & dedication', 'en-US': 'For attendance & dedication' },
    borderClass: 'bg-gradient-to-tr from-[#9E9E9E] via-[#E0E0E0] to-[#757575] shadow-sm',
    bgClass: 'ring-[#9E9E9E]/40',
    badgeBg: 'bg-gradient-to-tr from-[#757575] to-[#9E9E9E] text-white shadow-xs',
    icon: Shield,
    iconColor: 'text-[#616161]',
  },
  platinum: {
    name: { ar: 'إطار بلاتيني فاخر', 'en-GB': 'Platinum Elite', 'en-US': 'Platinum Elite' },
    desc: { ar: 'للطلاب من الأوائل والموهوبين', 'en-GB': 'For elite students & talent', 'en-US': 'For elite students & talent' },
    borderClass: 'bg-gradient-to-tr from-[#5E755A] via-[#E2E8F0] to-[#475569] shadow-sm',
    bgClass: 'ring-[#5E755A]/40',
    badgeBg: 'bg-gradient-to-tr from-[#475569] to-[#5E755A] text-white shadow-xs',
    icon: Award,
    iconColor: 'text-[#334155]',
  },
  crown: {
    name: { ar: 'تاج التميز الملكي', 'en-GB': 'Royal Crown', 'en-US': 'Royal Crown' },
    desc: { ar: 'لأصحاب المركز الأول في الاختبارات', 'en-GB': 'For first place in tests', 'en-US': 'For first place in tests' },
    borderClass: 'bg-gradient-to-tr from-[#D49B4B] via-[#FFE082] to-[#B88237] shadow-sm',
    bgClass: 'ring-[#D49B4B]/50',
    badgeBg: 'bg-gradient-to-tr from-[#B88237] to-[#D49B4B] text-white shadow-xs ring-1 ring-white',
    icon: Crown,
    iconColor: 'text-[#B88237]',
  },
  star: {
    name: { ar: 'نجمة التفوق والإبداع', 'en-GB': 'Star Performer', 'en-US': 'Star Performer' },
    desc: { ar: 'للمشاركة الفعالة والتطور السريع', 'en-GB': 'For active progress & participation', 'en-US': 'For active progress & participation' },
    borderClass: 'bg-gradient-to-tr from-[#C97C5D] via-[#FED7AA] to-[#EA580C] shadow-sm',
    bgClass: 'ring-[#C97C5D]/40',
    badgeBg: 'bg-gradient-to-tr from-[#EA580C] to-[#C97C5D] text-white shadow-xs',
    icon: Star,
    iconColor: 'text-[#C97C5D]',
  },
  champion: {
    name: { ar: 'بطل الدفعة والمجموعة', 'en-GB': 'Class Champion', 'en-US': 'Class Champion' },
    desc: { ar: 'لقائد المجموعة والدرجة النهائية', 'en-GB': 'For class leader & perfect score', 'en-US': 'For class leader & perfect score' },
    borderClass: 'bg-gradient-to-tr from-[#748C70] via-[#D1E7DD] to-[#2D332A] shadow-sm',
    bgClass: 'ring-[#748C70]/40',
    badgeBg: 'bg-gradient-to-tr from-[#2D332A] to-[#748C70] text-white shadow-xs ring-1 ring-white',
    icon: Award,
    iconColor: 'text-[#748C70]',
  },
  default: {
    name: { ar: 'افتراضي (بدون إطار)', 'en-GB': 'Default', 'en-US': 'Default' },
    desc: { ar: 'المظهر الافتراضي البسيط', 'en-GB': 'Default simple appearance', 'en-US': 'Default simple appearance' },
    borderClass: 'border-transparent',
    bgClass: '',
    badgeBg: '',
    icon: User,
    iconColor: 'text-[#8A9187]',
  },
  bronze_star: {
    name: { ar: 'نجمة برونزية (حضور متميز)', 'en-GB': 'Bronze Star', 'en-US': 'Bronze Star' },
    desc: { ar: 'للالتزام والمواظبة', 'en-GB': 'For attendance & commitment', 'en-US': 'For attendance & commitment' },
    borderClass: 'bg-gradient-to-tr from-[#CD7F32] via-[#E6B87D] to-[#8C521F] shadow-sm',
    bgClass: 'ring-[#CD7F32]/40',
    badgeBg: 'bg-gradient-to-tr from-[#8C521F] to-[#CD7F32] text-white shadow-xs',
    icon: Star,
    iconColor: 'text-[#CD7F32]',
  },
  silver_scholar: {
    name: { ar: 'باحث فضي (تفوق دراسي)', 'en-GB': 'Silver Scholar', 'en-US': 'Silver Scholar' },
    desc: { ar: 'للأداء الأكاديمي المتقدم', 'en-GB': 'For advanced academic performance', 'en-US': 'For advanced academic performance' },
    borderClass: 'bg-gradient-to-tr from-[#9E9E9E] via-[#E0E0E0] to-[#757575] shadow-sm',
    bgClass: 'ring-[#9E9E9E]/40',
    badgeBg: 'bg-gradient-to-tr from-[#757575] to-[#9E9E9E] text-white shadow-xs',
    icon: Shield,
    iconColor: 'text-[#616161]',
  },
  gold_champion: {
    name: { ar: 'بطل ذهبي (المركز الأول)', 'en-GB': 'Gold Champion', 'en-US': 'Gold Champion' },
    desc: { ar: 'للمركز الأول في الاختبارات والواجبات', 'en-GB': 'For 1st place in tests & assignments', 'en-US': 'For 1st place in tests & assignments' },
    borderClass: 'bg-gradient-to-tr from-[#B38728] via-[#FBF5B7] to-[#DAA520] shadow-sm',
    bgClass: 'ring-[#D49B4B]/40',
    badgeBg: 'bg-gradient-to-tr from-[#B38728] to-[#DAA520] text-white shadow-xs ring-1 ring-white',
    icon: Crown,
    iconColor: 'text-[#9C6615]',
  },
  diamond_elite: {
    name: { ar: 'نخبة الماس (عبقري الدفعة)', 'en-GB': 'Diamond Elite', 'en-US': 'Diamond Elite' },
    desc: { ar: 'لأعلى مستوى من التفوق الاستثنائي', 'en-GB': 'For outstanding genius & excellence', 'en-US': 'For outstanding genius & excellence' },
    borderClass: 'bg-gradient-to-tr from-[#0284C7] via-[#BAE6FD] to-[#0369A1] shadow-sm',
    bgClass: 'ring-[#0284C7]/40',
    badgeBg: 'bg-gradient-to-tr from-[#0369A1] to-[#0284C7] text-white shadow-xs ring-1 ring-white',
    icon: Sparkles,
    iconColor: 'text-[#0284C7]',
  },
  emerald_honor: {
    name: { ar: 'وسام الزمرد (سلوك وأخلاق)', 'en-GB': 'Emerald Honor', 'en-US': 'Emerald Honor' },
    desc: { ar: 'للقدوة الحسنة والأخلاق الرفيعة', 'en-GB': 'For role models & conduct', 'en-US': 'For role models & conduct' },
    borderClass: 'bg-gradient-to-tr from-[#059669] via-[#A7F3D0] to-[#047857] shadow-sm',
    bgClass: 'ring-[#059669]/40',
    badgeBg: 'bg-gradient-to-tr from-[#047857] to-[#059669] text-white shadow-xs',
    icon: Award,
    iconColor: 'text-[#059669]',
  },
};

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  name,
  avatarColor = '#748C70',
  profilePhoto,
  achievementFrame = 'none',
  size = 'md',
  className = '',
  showBadge = true,
}) => {
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;
  const frameInfo = achievementFrame && achievementFrame !== 'none' ? ACHIEVEMENT_FRAME_INFO[achievementFrame] : null;
  const BadgeIcon = frameInfo ? frameInfo.icon : null;

  // Initial letter
  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : 'ط';

  const hasPhoto = Boolean(profilePhoto && profilePhoto.startsWith('data:image'));

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {/* Outer Frame Wrapper */}
      <div
        className={`rounded-full flex items-center justify-center transition-all ${
          frameInfo ? `${frameInfo.borderClass} ${sizeConfig.framePadding}` : ''
        }`}
      >
        {/* Core Avatar Circle */}
        <div
          className={`${sizeConfig.container} rounded-full overflow-hidden flex items-center justify-center text-white font-bold select-none relative shadow-inner`}
          style={{ backgroundColor: hasPhoto ? '#E8E2D6' : avatarColor }}
        >
          {hasPhoto ? (
            <img
              src={profilePhoto!}
              alt={name}
              className="w-full h-full object-cover rounded-full"
              loading="lazy"
              onError={(e) => {
                // Fallback to initial if image fails
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="drop-shadow-xs">{initial}</span>
          )}
        </div>
      </div>

      {/* Frame Badge Overlay Icon (Top-Right / Crown Top) */}
      {showBadge && frameInfo && BadgeIcon && (
        <div
          className={`absolute ${sizeConfig.badge} rounded-full flex items-center justify-center ${frameInfo.badgeBg} z-10 animate-in zoom-in duration-150`}
          title={frameInfo.name.ar}
        >
          <BadgeIcon className={sizeConfig.iconSize} />
        </div>
      )}
    </div>
  );
};
