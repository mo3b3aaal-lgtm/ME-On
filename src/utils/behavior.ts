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
    color: 'text-[#0A3D62]',
    bgColor: 'bg-[#0A3D62]/8',
    borderColor: 'border-[#0A3D62]/25',
  },
  {
    id: 'outstanding_homework',
    name: 'حل واجب متقن ومثالي',
    nameEn: 'Outstanding homework completion',
    category: 'positive',
    emoji: '📚',
    points: 10,
    color: 'text-[#0A3D62]',
    bgColor: 'bg-[#FFFFFF]',
    borderColor: 'border-[#C7CDD3]',
  },
  {
    id: 'great_focus',
    name: 'تركيز وانتباه عالي',
    nameEn: 'Strong focus and attention',
    category: 'positive',
    emoji: '🎯',
    points: 5,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#C7CDD3]/15',
    borderColor: 'border-[#C7CDD3]',
  },
  {
    id: 'creative_answer',
    name: 'إجابة إبداعية / سؤال تحدي',
    nameEn: 'Creative answer / challenging question',
    category: 'positive',
    emoji: '💡',
    points: 15,
    color: 'text-[#0A3D62]',
    bgColor: 'bg-[#0A3D62]/10',
    borderColor: 'border-[#0A3D62]/30',
  },
  {
    id: 'exemplary_manners',
    name: 'أدب وسلوك راقي ومثالي',
    nameEn: 'Exemplary manners and conduct',
    category: 'positive',
    emoji: '🤝',
    points: 10,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#C7CDD3]/15',
    borderColor: 'border-[#C7CDD3]',
  },
  {
    id: 'noticeable_improvement',
    name: 'تحسن ملحوظ في الأداء',
    nameEn: 'Noticeable improvement in performance',
    category: 'positive',
    emoji: '🚀',
    points: 10,
    color: 'text-[#0A3D62]',
    bgColor: 'bg-[#0A3D62]/8',
    borderColor: 'border-[#0A3D62]/25',
  },
  {
    id: 'helping_classmates',
    name: 'مساعدة الزملاء وروح الفريق',
    nameEn: 'Helps classmates and demonstrates teamwork',
    category: 'positive',
    emoji: '❤️',
    points: 5,
    color: 'text-[#0A3D62]',
    bgColor: 'bg-[#C7CDD3]/15',
    borderColor: 'border-[#C7CDD3]',
  },

  // Needs Improvement Tags
  {
    id: 'needs_improvement',
    name: 'يحتاج تحسين التركيز',
    nameEn: 'Needs better focus and attention',
    category: 'needs_improvement',
    emoji: '⚠️',
    points: -5,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#16324F]/10',
    borderColor: 'border-[#16324F]/30',
  },
  {
    id: 'late_to_class',
    name: 'تأخر عن موعد الحصة',
    nameEn: 'Arrived late to the session',
    category: 'needs_improvement',
    emoji: '⏰',
    points: -5,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#16324F]/10',
    borderColor: 'border-[#16324F]/30',
  },
  {
    id: 'incomplete_homework',
    name: 'عدم إتمام الواجب المطلوب',
    nameEn: 'Incomplete required homework',
    category: 'needs_improvement',
    emoji: '❌',
    points: -10,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#16324F]/12',
    borderColor: 'border-[#16324F]/35',
  },
  {
    id: 'missing_tools',
    name: 'عدم إحضار الكشكول أو الأدوات',
    nameEn: 'Missing notebook or required tools',
    category: 'needs_improvement',
    emoji: '📝',
    points: -5,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#16324F]/10',
    borderColor: 'border-[#16324F]/30',
  },
  {
    id: 'disruptive_behavior',
    name: 'تشتيت الزملاء أو مقاطعة',
    nameEn: 'Disrupting classmates or interrupting',
    category: 'needs_improvement',
    emoji: '🔇',
    points: -5,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#16324F]/12',
    borderColor: 'border-[#16324F]/35',
  },
  {
    id: 'needs_parent_followup',
    name: 'يحتاج متابعة وتواصل مع ولي الأمر',
    nameEn: 'Requires follow-up with parent/guardian',
    category: 'needs_improvement',
    emoji: '📞',
    points: 0,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#16324F]/15',
    borderColor: 'border-[#16324F]/40',
  },

  // Neutral / Notes Tags
  {
    id: 'lesson_inquiry',
    name: 'استفسار مهم عن درس',
    nameEn: 'Important lesson inquiry',
    category: 'neutral',
    emoji: '❓',
    points: 0,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#C7CDD3]/15',
    borderColor: 'border-[#C7CDD3]',
  },
  {
    id: 'health_condition',
    name: 'ظرف صحي أو إجهاد',
    nameEn: 'Health / tired condition',
    category: 'neutral',
    emoji: '🩹',
    points: 0,
    color: 'text-[#6F7882]',
    bgColor: 'bg-[#C7CDD3]/15',
    borderColor: 'border-[#C7CDD3]',
  },
  {
    id: 'special_arrangement',
    name: 'ملاحظة أو اتفاق خاص',
    nameEn: 'Special note or arrangement',
    category: 'neutral',
    emoji: '🗓️',
    points: 0,
    color: 'text-[#16324F]',
    bgColor: 'bg-[#C7CDD3]/15',
    borderColor: 'border-[#C7CDD3]',
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
        badgeClass: 'bg-[#0A3D62]/10 text-[#0A3D62] border-[#0A3D62]/30',
        dotClass: 'bg-[#0A3D62]',
      };
    case 'needs_improvement':
      return {
        label: isEn ? 'Needs Improvement' : 'يحتاج تحسين',
        badgeClass: 'bg-[#16324F]/12 text-[#16324F] border-[#16324F]/35',
        dotClass: 'bg-[#16324F]',
      };
    case 'neutral':
    default:
      return {
        label: isEn ? 'General Remark' : 'ملاحظة عامة',
        badgeClass: 'bg-[#C7CDD3]/20 text-[#6F7882] border-[#C7CDD3]',
        dotClass: 'bg-[#6F7882]',
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
