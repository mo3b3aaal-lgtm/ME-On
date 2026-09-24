import { PredefinedBehaviorTag, BehaviorCategory, StudentBehaviorLog } from '../types';

export const PREDEFINED_BEHAVIOR_TAGS: PredefinedBehaviorTag[] = [
  // Positive Tags
  {
    id: 'excellent_participation',
    name: 'مشاركة وتفاعل ممتاز',
    nameEn: 'Excellent participation',
    category: 'positive',
    emoji: '🌟',
    points: 10,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    id: 'outstanding_homework',
    name: 'حل واجب متقن ومثالي',
    nameEn: 'Outstanding homework',
    category: 'positive',
    emoji: '📚',
    points: 10,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  {
    id: 'great_focus',
    name: 'تركيز وانتباه عالي',
    nameEn: 'Great focus & attention',
    category: 'positive',
    emoji: '🎯',
    points: 5,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  {
    id: 'creative_answer',
    name: 'إجابة إبداعية / سؤال تحدي',
    nameEn: 'Creative / Challenge question',
    category: 'positive',
    emoji: '💡',
    points: 15,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'exemplary_manners',
    name: 'أدب وسلوك راقي ومثالي',
    nameEn: 'Exemplary manners',
    category: 'positive',
    emoji: '🤝',
    points: 10,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'noticeable_improvement',
    name: 'تحسن ملحوظ في الأداء',
    nameEn: 'Noticeable improvement',
    category: 'positive',
    emoji: '🚀',
    points: 10,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    id: 'helping_classmates',
    name: 'مساعدة الزملاء وروح الفريق',
    nameEn: 'Helping classmates',
    category: 'positive',
    emoji: '❤️',
    points: 5,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },

  // Needs Improvement Tags
  {
    id: 'needs_improvement',
    name: 'يحتاج تحسين التركيز',
    nameEn: 'Needs improvement in focus',
    category: 'needs_improvement',
    emoji: '⚠️',
    points: -5,
    color: 'text-amber-800',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'late_to_class',
    name: 'تأخر عن موعد الحصة',
    nameEn: 'Late to class',
    category: 'needs_improvement',
    emoji: '⏰',
    points: -5,
    color: 'text-orange-800',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    id: 'incomplete_homework',
    name: 'عدم إتمام الواجب المطلوب',
    nameEn: 'Incomplete homework',
    category: 'needs_improvement',
    emoji: '❌',
    points: -10,
    color: 'text-rose-800',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
  {
    id: 'missing_tools',
    name: 'عدم إحضار الكشكول أو الأدوات',
    nameEn: 'Missing notebook / tools',
    category: 'needs_improvement',
    emoji: '📝',
    points: -5,
    color: 'text-orange-800',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    id: 'disruptive_behavior',
    name: 'تشتيت الزملاء أو مقاطعة',
    nameEn: 'Disrupting class',
    category: 'needs_improvement',
    emoji: '🔇',
    points: -5,
    color: 'text-rose-800',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
  {
    id: 'needs_parent_followup',
    name: 'يحتاج متابعة وتواصل مع ولي الأمر',
    nameEn: 'Needs parent follow-up',
    category: 'needs_improvement',
    emoji: '📞',
    points: 0,
    color: 'text-red-800',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },

  // Neutral / Notes Tags
  {
    id: 'lesson_inquiry',
    name: 'استفسار مهم عن درس',
    nameEn: 'Question about lesson',
    category: 'neutral',
    emoji: '❓',
    points: 0,
    color: 'text-sky-800',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
  },
  {
    id: 'health_condition',
    name: 'ظرف صحي أو إجهاد',
    nameEn: 'Health / tired condition',
    category: 'neutral',
    emoji: '🩹',
    points: 0,
    color: 'text-slate-800',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
  {
    id: 'special_arrangement',
    name: 'ملاحظة أو اتفاق خاص',
    nameEn: 'Special note or arrangement',
    category: 'neutral',
    emoji: '🗓️',
    points: 0,
    color: 'text-indigo-800',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
];

export function getCategoryBadge(category: BehaviorCategory): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (category) {
    case 'positive':
      return {
        label: 'تميز وإيجابي',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
      };
    case 'needs_improvement':
      return {
        label: 'يحتاج تحسين',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500',
      };
    case 'neutral':
    default:
      return {
        label: 'ملاحظة عامة',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
      };
  }
}

export function formatBehaviorTime(timestamp: string): {
  relativeTime: string;
  formattedDate: string;
  formattedTime: string;
  isToday: boolean;
} {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      return {
        relativeTime: 'الآن',
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

    const formattedTime = d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const formattedDate = d.toLocaleDateString('ar-EG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let relativeTime = `${formattedDate} • ${formattedTime}`;
    if (isToday) {
      relativeTime = `اليوم، ${formattedTime}`;
    } else if (isYesterday) {
      relativeTime = `أمس، ${formattedTime}`;
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
