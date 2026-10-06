import { PredefinedBehaviorTag, BehaviorCategory, StudentBehaviorLog } from '../types';
import { getAppLanguage } from './i18n';

export const PREDEFINED_BEHAVIOR_TAGS: PredefinedBehaviorTag[] = [
  // Positive Tags
  {
    id: 'excellent_participation',
    name: 'مشاركة وتفاعل ممتاز',
    nameEn: 'Excellent participation and engagement',
    category: 'positive',
    emoji: '🌟',
    points: 10,
    color: 'text-[#8E6835]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#B68A4C]/50',
  },
  {
    id: 'outstanding_homework',
    name: 'حل واجب متقن ومثالي',
    nameEn: 'Outstanding homework completion',
    category: 'positive',
    emoji: '📚',
    points: 10,
    color: 'text-[#6B1E2B]',
    bgColor: 'bg-[#FAF7F2]',
    borderColor: 'border-[#B6A89C]',
  },
  {
    id: 'great_focus',
    name: 'تركيز وانتباه عالي',
    nameEn: 'Strong focus and attention',
    category: 'positive',
    emoji: '🎯',
    points: 5,
    color: 'text-[#5C4033]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#B68A4C]/40',
  },
  {
    id: 'creative_answer',
    name: 'إجابة إبداعية / سؤال تحدي',
    nameEn: 'Creative answer / challenging question',
    category: 'positive',
    emoji: '💡',
    points: 15,
    color: 'text-[#8E6835]',
    bgColor: 'bg-[#EADBC7]/45',
    borderColor: 'border-[#B68A4C]/60',
  },
  {
    id: 'exemplary_manners',
    name: 'أدب وسلوك راقي ومثالي',
    nameEn: 'Exemplary manners and conduct',
    category: 'positive',
    emoji: '🤝',
    points: 10,
    color: 'text-[#5C4033]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#B6A89C]',
  },
  {
    id: 'noticeable_improvement',
    name: 'تحسن ملحوظ في الأداء',
    nameEn: 'Noticeable improvement in performance',
    category: 'positive',
    emoji: '🚀',
    points: 10,
    color: 'text-[#9A5635]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#B56B45]/45',
  },
  {
    id: 'helping_classmates',
    name: 'مساعدة الزملاء وروح الفريق',
    nameEn: 'Helps classmates and demonstrates teamwork',
    category: 'positive',
    emoji: '❤️',
    points: 5,
    color: 'text-[#6B1E2B]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#6B1E2B]/30',
  },

  // Needs Improvement Tags
  {
    id: 'needs_improvement',
    name: 'يحتاج تحسين التركيز',
    nameEn: 'Needs better focus and attention',
    category: 'needs_improvement',
    emoji: '⚠️',
    points: -5,
    color: 'text-[#9A5635]',
    bgColor: 'bg-[#EADBC7]/55',
    borderColor: 'border-[#B56B45]/50',
  },
  {
    id: 'late_to_class',
    name: 'تأخر عن موعد الحصة',
    nameEn: 'Arrived late to the session',
    category: 'needs_improvement',
    emoji: '⏰',
    points: -5,
    color: 'text-[#9A5635]',
    bgColor: 'bg-[#EADBC7]/55',
    borderColor: 'border-[#B56B45]/50',
  },
  {
    id: 'incomplete_homework',
    name: 'عدم إتمام الواجب المطلوب',
    nameEn: 'Incomplete required homework',
    category: 'needs_improvement',
    emoji: '❌',
    points: -10,
    color: 'text-[#6B1E2B]',
    bgColor: 'bg-[#6B1E2B]/10',
    borderColor: 'border-[#6B1E2B]/30',
  },
  {
    id: 'missing_tools',
    name: 'عدم إحضار الكشكول أو الأدوات',
    nameEn: 'Missing notebook or required tools',
    category: 'needs_improvement',
    emoji: '📝',
    points: -5,
    color: 'text-[#9A5635]',
    bgColor: 'bg-[#EADBC7]/55',
    borderColor: 'border-[#B56B45]/50',
  },
  {
    id: 'disruptive_behavior',
    name: 'تشتيت الزملاء أو مقاطعة',
    nameEn: 'Disrupting classmates or interrupting',
    category: 'needs_improvement',
    emoji: '🔇',
    points: -5,
    color: 'text-[#6B1E2B]',
    bgColor: 'bg-[#6B1E2B]/10',
    borderColor: 'border-[#6B1E2B]/30',
  },
  {
    id: 'needs_parent_followup',
    name: 'يحتاج متابعة وتواصل مع ولي الأمر',
    nameEn: 'Requires follow-up with parent/guardian',
    category: 'needs_improvement',
    emoji: '📞',
    points: 0,
    color: 'text-[#6B1E2B]',
    bgColor: 'bg-[#6B1E2B]/15',
    borderColor: 'border-[#6B1E2B]/40',
  },

  // Neutral / Notes Tags
  {
    id: 'lesson_inquiry',
    name: 'استفسار مهم عن درس',
    nameEn: 'Important lesson inquiry',
    category: 'neutral',
    emoji: '❓',
    points: 0,
    color: 'text-[#5C4033]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#B6A89C]',
  },
  {
    id: 'health_condition',
    name: 'ظرف صحي أو إجهاد',
    nameEn: 'Health / tired condition',
    category: 'neutral',
    emoji: '🩹',
    points: 0,
    color: 'text-[#69493C]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#EADBC7]',
  },
  {
    id: 'special_arrangement',
    name: 'ملاحظة أو اتفاق خاص',
    nameEn: 'Special note or arrangement',
    category: 'neutral',
    emoji: '🗓️',
    points: 0,
    color: 'text-[#5C4033]',
    bgColor: 'bg-[#F8F2EA]',
    borderColor: 'border-[#B6A89C]',
  },
];

export function getLocalizedBehaviorTagName(tagIdOrName: string, lang?: string): string {
  const currentLang = lang || getAppLanguage();
  const isEn = currentLang.startsWith('en');

  const found = PREDEFINED_BEHAVIOR_TAGS.find(
    (t) => t.id === tagIdOrName || t.name === tagIdOrName || t.nameEn === tagIdOrName
  );

  if (found) {
    return isEn ? (found.nameEn || found.name) : found.name;
  }
  return tagIdOrName;
}

export function getCategoryBadge(category: BehaviorCategory, lang?: string): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  const currentLang = lang || getAppLanguage();
  const isEn = currentLang.startsWith('en');

  switch (category) {
    case 'positive':
      return {
        label: isEn ? 'Merit & Positive' : 'تميز وإيجابي',
        badgeClass: 'bg-[#F8F2EA] text-[#8E6835] border-[#B68A4C]/50',
        dotClass: 'bg-[#B68A4C]',
      };
    case 'needs_improvement':
      return {
        label: isEn ? 'Needs Improvement' : 'يحتاج تحسين',
        badgeClass: 'bg-[#6B1E2B]/10 text-[#6B1E2B] border-[#6B1E2B]/30',
        dotClass: 'bg-[#6B1E2B]',
      };
    case 'neutral':
    default:
      return {
        label: isEn ? 'General Remark' : 'ملاحظة عامة',
        badgeClass: 'bg-[#F8F2EA] text-[#5C4033] border-[#B6A89C]',
        dotClass: 'bg-[#69493C]',
      };
  }
}

export function formatBehaviorTime(timestamp: string, lang?: string): {
  relativeTime: string;
  formattedDate: string;
  formattedTime: string;
  isToday: boolean;
} {
  const currentLang = lang || getAppLanguage();
  const isEn = currentLang.startsWith('en');

  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      return {
        relativeTime: isEn ? 'Just now' : 'الآن',
        formattedDate: '',
        formattedTime: '',
        isToday: true,
      };
    }

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const locale = isEn ? (currentLang === 'en-GB' ? 'en-GB' : 'en-US') : 'ar-EG';

    const formattedTime = d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const formattedDate = d.toLocaleDateString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let relativeTime = `${formattedDate} • ${formattedTime}`;
    if (isToday) {
      relativeTime = isEn ? `Today, ${formattedTime}` : `اليوم، ${formattedTime}`;
    } else if (isYesterday) {
      relativeTime = isEn ? `Yesterday, ${formattedTime}` : `أمس، ${formattedTime}`;
    }

    return {
      relativeTime,
      formattedDate,
      formattedTime,
      isToday,
    };
  } catch {
    return {
      relativeTime: timestamp,
      formattedDate: '',
      formattedTime: '',
      isToday: false,
    };
  }
}

export function calculateStudentBehaviorStats(logs: StudentBehaviorLog[]): {
  totalLogs: number;
  totalPoints: number;
  positiveCount: number;
  needsImprovementCount: number;
  neutralCount: number;
  mostFrequentTag?: string;
} {
  let totalPoints = 0;
  let positiveCount = 0;
  let needsImprovementCount = 0;
  let neutralCount = 0;
  const tagCounts: Record<string, number> = {};

  for (const log of logs) {
    totalPoints += log.points || 0;
    if (log.category === 'positive') positiveCount++;
    else if (log.category === 'needs_improvement') needsImprovementCount++;
    else neutralCount++;

    if (log.tag) {
      tagCounts[log.tag] = (tagCounts[log.tag] || 0) + 1;
    }
  }

  let mostFrequentTag: string | undefined = undefined;
  let maxCount = 0;
  for (const [tag, count] of Object.entries(tagCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentTag = tag;
    }
  }

  return {
    totalLogs: logs.length,
    totalPoints,
    positiveCount,
    needsImprovementCount,
    neutralCount,
    mostFrequentTag,
  };
}
