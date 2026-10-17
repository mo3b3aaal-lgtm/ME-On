import React from 'react';
import { AppIcon, type AppIconName } from './ui/AppIcon';
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
  icon: AppIconName;
  iconColor: string;
}

export const LUXURY_AVATAR_PALETTE = [
  '#17375E', // Sapphire
  '#0F2A4A', // Navy
  '#5F7083', // Steel Grey
];

const ALLOWED_LUXURY_HEX_SET = new Set([
  '#17375E',
  '#0F2A4A'.toLowerCase(),
  '#5F7083',
  '#E1EBEC',
  '#FFFFFF',
]);

export function normalizeLuxuryColor(color?: string | null, fallback: string = '#17375E'): string {
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
    name: { ar: 'افتراضي بدون إطار', 'en-GB': 'No Frame (Default)', 'en-US': 'No Frame (Default)' },
    desc: { ar: 'المظهر الافتراضي البسيط بدون إطار إضافي', 'en-GB': 'Clean default circular avatar with no extra frame', 'en-US': 'Clean default circular avatar with no extra frame' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#5F7083',
    bgClass: '',
    badgeBg: '',
    icon: 'user',
    iconColor: 'text-[#5F7083]',
  },
  default: {
    id: 'default',
    name: { ar: 'افتراضي بدون إطار', 'en-GB': 'No Frame (Default)', 'en-US': 'No Frame (Default)' },
    desc: { ar: 'المظهر الافتراضي البسيط', 'en-GB': 'Default simple appearance', 'en-US': 'Default simple appearance' },
    tierLabel: { ar: 'افتراضي', 'en-GB': 'Standard', 'en-US': 'Standard' },
    tierNumber: 0,
    themeColor: '#5F7083',
    bgClass: '',
    badgeBg: '',
    icon: 'user',
    iconColor: 'text-[#5F7083]',
  },
  silver: {
    id: 'silver',
    name: { ar: 'فضي — Silver', 'en-GB': 'Silver', 'en-US': 'Silver' },
    desc: { ar: 'معدن فضي مصقول مع إضاءات نقية وتفاصيل غار هندسية راقية', 'en-GB': 'Polished silver metal with cool white highlights and refined laurels', 'en-US': 'Polished silver metal with cool white highlights and refined laurels' },
    tierLabel: { ar: 'فضي Silver', 'en-GB': 'Silver Tier', 'en-US': 'Silver Tier' },
    tierNumber: 1,
    themeColor: '#94A3B8',
    bgClass: 'ring-[#94A3B8]',
    badgeBg: 'bg-gradient-to-tr from-slate-600 to-slate-400 text-white shadow-md',
    icon: 'shield',
    iconColor: 'text-white',
  },
  silver_scholar: {
    id: 'silver_scholar',
    name: { ar: 'فضي — Silver', 'en-GB': 'Silver', 'en-US': 'Silver' },
    desc: { ar: 'معدن فضي مصقول مع إضاءات نقية وتفاصيل غار هندسية راقية', 'en-GB': 'Polished silver metal with cool white highlights and refined laurels', 'en-US': 'Polished silver metal with cool white highlights and refined laurels' },
    tierLabel: { ar: 'فضي Silver', 'en-GB': 'Silver Tier', 'en-US': 'Silver Tier' },
    tierNumber: 1,
    themeColor: '#94A3B8',
    bgClass: 'ring-[#94A3B8]',
    badgeBg: 'bg-gradient-to-tr from-slate-600 to-slate-400 text-white shadow-md',
    icon: 'shield',
    iconColor: 'text-white',
  },
  gold: {
    id: 'gold',
    name: { ar: 'ذهبي — Gold', 'en-GB': 'Gold', 'en-US': 'Gold' },
    desc: { ar: 'ذهب معدني فاخر مع انعكاسات دافئة وأكاليل إنجاز ملكية وتفاصيل تاج', 'en-GB': 'Rich metallic gold with warm reflections and prestigious laurels', 'en-US': 'Rich metallic gold with warm reflections and prestigious laurels' },
    tierLabel: { ar: 'ذهبي Gold', 'en-GB': 'Gold Tier', 'en-US': 'Gold Tier' },
    tierNumber: 2,
    themeColor: '#F59E0B',
    bgClass: 'ring-[#F59E0B]',
    badgeBg: 'bg-gradient-to-tr from-amber-600 to-yellow-400 text-white shadow-md',
    icon: 'award',
    iconColor: 'text-white',
  },
  gold_champion: {
    id: 'gold_champion',
    name: { ar: 'ذهبي — Gold', 'en-GB': 'Gold', 'en-US': 'Gold' },
    desc: { ar: 'ذهب معدني فاخر مع انعكاسات دافئة وأكاليل إنجاز ملكية وتفاصيل تاج', 'en-GB': 'Rich metallic gold with warm reflections and prestigious laurels', 'en-US': 'Rich metallic gold with warm reflections and prestigious laurels' },
    tierLabel: { ar: 'ذهبي Gold', 'en-GB': 'Gold Tier', 'en-US': 'Gold Tier' },
    tierNumber: 2,
    themeColor: '#F59E0B',
    bgClass: 'ring-[#F59E0B]',
    badgeBg: 'bg-gradient-to-tr from-amber-600 to-yellow-400 text-white shadow-md',
    icon: 'award',
    iconColor: 'text-white',
  },
  platinum: {
    id: 'platinum',
    name: { ar: 'بلاتينيوم — Platinum', 'en-GB': 'Platinum', 'en-US': 'Platinum' },
    desc: { ar: 'بلاتين مشع فائق مع لمسات كريستالية فضية ثلجية وأوجه هندسية براقة', 'en-GB': 'Luminous platinum with icy silver-blue facets and crystalline detailing', 'en-US': 'Luminous platinum with icy silver-blue facets and crystalline detailing' },
    tierLabel: { ar: 'بلاتينيوم Platinum', 'en-GB': 'Platinum Tier', 'en-US': 'Platinum Tier' },
    tierNumber: 3,
    themeColor: '#0284C7',
    bgClass: 'ring-[#38BDF8]',
    badgeBg: 'bg-gradient-to-tr from-sky-600 to-cyan-300 text-white shadow-md',
    icon: 'sparkles',
    iconColor: 'text-white',
  },
  vip: {
    id: 'vip',
    name: { ar: 'VIP — النخبة الملكية', 'en-GB': 'VIP Elite', 'en-US': 'VIP Elite' },
    desc: { ar: 'أوبسيديان فاحم فاخر مع ذهب ملكي نقي وأحجار عنبر متوهجة', 'en-GB': 'Dark obsidian with luxurious gold tracery and amber highlights', 'en-US': 'Dark obsidian with luxurious gold tracery and amber highlights' },
    tierLabel: { ar: 'VIP نخبة', 'en-GB': 'VIP Elite', 'en-US': 'VIP Elite' },
    tierNumber: 4,
    themeColor: '#D97706',
    bgClass: 'ring-[#F59E0B]',
    badgeBg: 'bg-gradient-to-tr from-zinc-950 via-amber-800 to-amber-500 text-amber-200 shadow-lg',
    icon: 'crown',
    iconColor: 'text-amber-300',
  },
  crown: {
    id: 'crown',
    name: { ar: 'VIP — النخبة الملكية', 'en-GB': 'VIP Elite', 'en-US': 'VIP Elite' },
    desc: { ar: 'أوبسيديان فاحم فاخر مع ذهب ملكي نقي وأحجار عنبر متوهجة', 'en-GB': 'Dark obsidian with luxurious gold tracery and amber highlights', 'en-US': 'Dark obsidian with luxurious gold tracery and amber highlights' },
    tierLabel: { ar: 'VIP نخبة', 'en-GB': 'VIP Elite', 'en-US': 'VIP Elite' },
    tierNumber: 4,
    themeColor: '#D97706',
    bgClass: 'ring-[#F59E0B]',
    badgeBg: 'bg-gradient-to-tr from-zinc-950 via-amber-800 to-amber-500 text-amber-200 shadow-lg',
    icon: 'crown',
    iconColor: 'text-amber-300',
  },
  champion: {
    id: 'champion',
    name: { ar: 'VIP — النخبة الملكية', 'en-GB': 'VIP Elite', 'en-US': 'VIP Elite' },
    desc: { ar: 'أوبسيديان فاحم فاخر مع ذهب ملكي نقي وأحجار عنبر متوهجة', 'en-GB': 'Dark obsidian with luxurious gold tracery and amber highlights', 'en-US': 'Dark obsidian with luxurious gold tracery and amber highlights' },
    tierLabel: { ar: 'VIP نخبة', 'en-GB': 'VIP Elite', 'en-US': 'VIP Elite' },
    tierNumber: 4,
    themeColor: '#D97706',
    bgClass: 'ring-[#F59E0B]',
    badgeBg: 'bg-gradient-to-tr from-zinc-950 via-amber-800 to-amber-500 text-amber-200 shadow-lg',
    icon: 'crown',
    iconColor: 'text-amber-300',
  },
  story: {
    id: 'story',
    name: { ar: 'ستوري — Story', 'en-GB': 'Story', 'en-US': 'Story' },
    desc: { ar: 'أرجواني كهربائي وميجينتا وسايان بتصميم جيمنج مستقبلي وطبقات مضيئة', 'en-GB': 'Vibrant electric purple, magenta, and cyan with futuristic geometry', 'en-US': 'Vibrant electric purple, magenta, and cyan with futuristic geometry' },
    tierLabel: { ar: 'ستوري Story', 'en-GB': 'Story Tier', 'en-US': 'Story Tier' },
    tierNumber: 5,
    themeColor: '#A855F7',
    bgClass: 'ring-[#A855F7]',
    badgeBg: 'bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-pink-400 text-white shadow-md',
    icon: 'sparkles',
    iconColor: 'text-white',
  },
  diamond_elite: {
    id: 'diamond_elite',
    name: { ar: 'ستوري — Story', 'en-GB': 'Story', 'en-US': 'Story' },
    desc: { ar: 'أرجواني كهربائي وميجينتا وسايان بتصميم جيمنج مستقبلي وطبقات مضيئة', 'en-GB': 'Vibrant electric purple, magenta, and cyan with futuristic geometry', 'en-US': 'Vibrant electric purple, magenta, and cyan with futuristic geometry' },
    tierLabel: { ar: 'ستوري Story', 'en-GB': 'Story Tier', 'en-US': 'Story Tier' },
    tierNumber: 5,
    themeColor: '#A855F7',
    bgClass: 'ring-[#A855F7]',
    badgeBg: 'bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-pink-400 text-white shadow-md',
    icon: 'sparkles',
    iconColor: 'text-white',
  },
  challenge: {
    id: 'challenge',
    name: { ar: 'تحدي — Challenge', 'en-GB': 'Challenge', 'en-US': 'Challenge' },
    desc: { ar: 'درع ناري هجومي بأحمر حارق ولهب ذهبي وزوايا حادة للإنجازات الكبرى', 'en-GB': 'Fiery red, molten orange, and aggressive angular battle armor', 'en-US': 'Fiery red, molten orange, and aggressive angular battle armor' },
    tierLabel: { ar: 'تحدي Challenge', 'en-GB': 'Challenge Tier', 'en-US': 'Challenge Tier' },
    tierNumber: 6,
    themeColor: '#EF4444',
    bgClass: 'ring-[#EF4444]',
    badgeBg: 'bg-gradient-to-tr from-red-700 to-orange-500 text-white shadow-md',
    icon: 'flame',
    iconColor: 'text-white',
  },
  bronze_star: {
    id: 'bronze_star',
    name: { ar: 'تحدي — Challenge', 'en-GB': 'Challenge', 'en-US': 'Challenge' },
    desc: { ar: 'درع ناري هجومي بأحمر حارق ولهب ذهبي وزوايا حادة للإنجازات الكبرى', 'en-GB': 'Fiery red, molten orange, and aggressive angular battle armor', 'en-US': 'Fiery red, molten orange, and aggressive angular battle armor' },
    tierLabel: { ar: 'تحدي Challenge', 'en-GB': 'Challenge Tier', 'en-US': 'Challenge Tier' },
    tierNumber: 6,
    themeColor: '#EF4444',
    bgClass: 'ring-[#EF4444]',
    badgeBg: 'bg-gradient-to-tr from-red-700 to-orange-500 text-white shadow-md',
    icon: 'flame',
    iconColor: 'text-white',
  },
  nature: {
    id: 'nature',
    name: { ar: 'طبيعة — Nature', 'en-GB': 'Nature', 'en-US': 'Nature' },
    desc: { ar: 'زمرد أخضر ملكي ويشم نقي متداخل مع أوراق غار ذهبية عريقة', 'en-GB': 'Emerald green and pure jade with antique brushed-gold laurel leaves', 'en-US': 'Emerald green and pure jade with antique brushed-gold laurel leaves' },
    tierLabel: { ar: 'طبيعة Nature', 'en-GB': 'Nature Tier', 'en-US': 'Nature Tier' },
    tierNumber: 7,
    themeColor: '#10B981',
    bgClass: 'ring-[#10B981]',
    badgeBg: 'bg-gradient-to-tr from-emerald-800 to-emerald-500 text-white shadow-md',
    icon: 'gem',
    iconColor: 'text-white',
  },
  emerald_honor: {
    id: 'emerald_honor',
    name: { ar: 'طبيعة — Nature', 'en-GB': 'Nature', 'en-US': 'Nature' },
    desc: { ar: 'زمرد أخضر ملكي ويشم نقي متداخل مع أوراق غار ذهبية عريقة', 'en-GB': 'Emerald green and pure jade with antique brushed-gold laurel leaves', 'en-US': 'Emerald green and pure jade with antique brushed-gold laurel leaves' },
    tierLabel: { ar: 'طبيعة Nature', 'en-GB': 'Nature Tier', 'en-US': 'Nature Tier' },
    tierNumber: 7,
    themeColor: '#10B981',
    bgClass: 'ring-[#10B981]',
    badgeBg: 'bg-gradient-to-tr from-emerald-800 to-emerald-500 text-white shadow-md',
    icon: 'gem',
    iconColor: 'text-white',
  },
  cosmic: {
    id: 'cosmic',
    name: { ar: 'كوني — Cosmic', 'en-GB': 'Cosmic', 'en-US': 'Cosmic' },
    desc: { ar: 'أزرق كحلي نفاث مع كريستال أزرق كهربائي ونجوم ومدارات فلكية ساطعة', 'en-GB': 'Deep space navy, electric cyan crystals, and glowing orbital rings', 'en-US': 'Deep space navy, electric cyan crystals, and glowing orbital rings' },
    tierLabel: { ar: 'كوني Cosmic', 'en-GB': 'Cosmic Tier', 'en-US': 'Cosmic Tier' },
    tierNumber: 8,
    themeColor: '#6366F1',
    bgClass: 'ring-[#6366F1]',
    badgeBg: 'bg-gradient-to-tr from-indigo-900 to-cyan-500 text-white shadow-md',
    icon: 'star',
    iconColor: 'text-white',
  },
  star: {
    id: 'star',
    name: { ar: 'كوني — Cosmic', 'en-GB': 'Cosmic', 'en-US': 'Cosmic' },
    desc: { ar: 'أزرق كحلي نفاث مع كريستال أزرق كهربائي ونجوم ومدارات فلكية ساطعة', 'en-GB': 'Deep space navy, electric cyan crystals, and glowing orbital rings', 'en-US': 'Deep space navy, electric cyan crystals, and glowing orbital rings' },
    tierLabel: { ar: 'كوني Cosmic', 'en-GB': 'Cosmic Tier', 'en-US': 'Cosmic Tier' },
    tierNumber: 8,
    themeColor: '#6366F1',
    bgClass: 'ring-[#6366F1]',
    badgeBg: 'bg-gradient-to-tr from-indigo-900 to-cyan-500 text-white shadow-md',
    icon: 'star',
    iconColor: 'text-white',
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
  const finalColor = normalizeLuxuryColor(student?.avatarColor || propColor, '#17375E');
  const isLightAvatarBg = finalColor === '#FFFFFF' || finalColor === '#E1EBEC';
  const finalPhoto = student?.profilePhoto !== undefined ? student?.profilePhoto : propPhoto;
  const rawFrame = (student?.achievementFrame || propFrame || 'none') as AchievementFrame;

  const hasFrame = showFrame && rawFrame && rawFrame !== 'none' && rawFrame !== 'default';
  const frameInfo = hasFrame ? ACHIEVEMENT_FRAME_INFO[rawFrame] || ACHIEVEMENT_FRAME_INFO.gold_champion : null;

  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const initial = finalName.trim() ? finalName.trim().charAt(0).toUpperCase() : (isEn ? 'S' : 'ط');

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

  const frameTitle = frameInfo ? (frameInfo.name[currentLang] || frameInfo.name.ar) : '';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${
        hasFrame ? `${sizeConfig.framedContainer} gaming-frame-root frame-${rawFrame}` : sizeConfig.noFrameContainer
      } ${className}`}
    >
      {/* Core Avatar Photo / Initial Circle */}
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center gaming-frame-avatar-inner ${
          isLightAvatarBg ? 'text-[#0F2A4A]' : 'text-[#FFFFFF]'
        } font-bold select-none relative shadow-inner z-0 ${
          hasFrame ? `${sizeConfig.photoFramed} ring-1 ring-[#0F2A4A]/25` : 'w-full h-full shadow-sm'
        }`}
        style={{ backgroundColor: hasPhoto ? '#E1EBEC' : finalColor }}
      >
        {hasPhoto ? (
          <img
            src={finalPhoto!}
            alt={finalName}
            className="w-full h-full object-cover rounded-full pointer-events-none"
            loading="lazy"
            onError={() => {
              setImgError(true);
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
      {showBadge && frameInfo && (
        <div
          className={`absolute ${sizeConfig.badge} rounded-full flex items-center justify-center ${frameInfo.badgeBg} z-20 animate-in zoom-in duration-150 motion-reduce:animate-none`}
          title={frameTitle}
        >
          <AppIcon name={frameInfo.icon} weight="fill" className={sizeConfig.iconSize} />
        </div>
      )}
    </div>
  );
};
