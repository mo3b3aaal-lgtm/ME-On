import {
  AchievementFrame,
  Attendance,
  HomeworkAssignment,
  LevelFrameId,
  Session,
  Student,
  StudentBehaviorLog,
  StudentProgressionLevel,
} from '../types';
import { db } from './storage';

export type StudentBehaviorStanding = 'exemplary' | 'positive' | 'steady' | 'needs_attention';

export interface LevelFrameDefinition {
  level: StudentProgressionLevel;
  frameId: LevelFrameId;
  assetSrc: string;
  minXp: number;
  nextLevelXp: number | null;
  isMax: boolean;
  holeDiameterRatio: number;
  aspectSpanRatio: number;
  shortLabelAr: string;
  shortLabelEn: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  accentHex: string;
}

export const LEVEL_FRAME_DEFINITIONS: Record<StudentProgressionLevel, LevelFrameDefinition> = {
  1: {
    level: 1,
    frameId: 'level_1',
    assetSrc: '/assets/frames/level-1.png',
    minXp: 0,
    nextLevelXp: 45,
    isMax: false,
    holeDiameterRatio: 0.7333,
    aspectSpanRatio: 1.0,
    shortLabelAr: 'المستوى 1',
    shortLabelEn: 'Lv. 1',
    titleAr: 'المستوى 1 — بداية واعدة',
    titleEn: 'Level 1 — Rising Starter',
    descAr: 'إطار ذهبي أنيق لبداية رحلة الالتزام والتعلم',
    descEn: 'Refined golden ring marking the start of steady commitment',
    accentHex: '#D97706',
  },
  2: {
    level: 2,
    frameId: 'level_2',
    assetSrc: '/assets/frames/level-2.png',
    minXp: 45,
    nextLevelXp: 105,
    isMax: false,
    holeDiameterRatio: 0.6654,
    aspectSpanRatio: 1.0,
    shortLabelAr: 'المستوى 2',
    shortLabelEn: 'Lv. 2',
    titleAr: 'المستوى 2 — طالب منتظم',
    titleEn: 'Level 2 — Steady Learner',
    descAr: 'طوق ذهبي مزدوج المشابك يعكس الانتظام في الحضور',
    descEn: 'Clasped golden band reflecting consistent class attendance',
    accentHex: '#D97706',
  },
  3: {
    level: 3,
    frameId: 'level_3',
    assetSrc: '/assets/frames/level-3.png',
    minXp: 105,
    nextLevelXp: 180,
    isMax: false,
    holeDiameterRatio: 0.6365,
    aspectSpanRatio: 1.0,
    shortLabelAr: 'المستوى 3',
    shortLabelEn: 'Lv. 3',
    titleAr: 'المستوى 3 — مجتهد مثابر',
    titleEn: 'Level 3 — Diligent Scholar',
    descAr: 'إطار ذهبي مصقول يبرز المثابرة وإتمام الواجبات',
    descEn: 'Beveled gold band honoring perseverance and homework completion',
    accentHex: '#F59E0B',
  },
  4: {
    level: 4,
    frameId: 'level_4',
    assetSrc: '/assets/frames/level-4.png',
    minXp: 180,
    nextLevelXp: 275,
    isMax: false,
    holeDiameterRatio: 0.6360,
    aspectSpanRatio: 1.0,
    shortLabelAr: 'المستوى 4',
    shortLabelEn: 'Lv. 4',
    titleAr: 'المستوى 4 — متقدم متفاعل',
    titleEn: 'Level 4 — Active Achiever',
    descAr: 'إطار ذهبي ملكي متين للتفاعل الإيجابي المستمر في الحصص',
    descEn: 'Heavy forged royal gold ring for active class participation',
    accentHex: '#F59E0B',
  },
  5: {
    level: 5,
    frameId: 'level_5',
    assetSrc: '/assets/frames/level-5.png',
    minXp: 275,
    nextLevelXp: 390,
    isMax: false,
    holeDiameterRatio: 0.5596,
    aspectSpanRatio: 1.0,
    shortLabelAr: 'المستوى 5',
    shortLabelEn: 'Lv. 5',
    titleAr: 'المستوى 5 — متميز ذهبي',
    titleEn: 'Level 5 — Golden Distinction',
    descAr: 'زخارف ذهبية مرصعة بالألماس للطلاب المتفوقين سلوكًا وأداءً',
    descEn: 'Diamond-set baroque filigree for distinguished conduct and study',
    accentHex: '#B45309',
  },
  6: {
    level: 6,
    frameId: 'level_6',
    assetSrc: '/assets/frames/level-6.png',
    minXp: 390,
    nextLevelXp: 530,
    isMax: false,
    holeDiameterRatio: 0.5129,
    aspectSpanRatio: 1.0,
    shortLabelAr: 'المستوى 6',
    shortLabelEn: 'Lv. 6',
    titleAr: 'المستوى 6 — وسام التفوق',
    titleEn: 'Level 6 — Crest of Merit',
    descAr: 'وسام ذهبي رباعي مرصع بأحجار الجمشت الملكية',
    descEn: 'Four-point golden crest set with royal amethyst gems',
    accentHex: '#7E22CE',
  },
  7: {
    level: 7,
    frameId: 'level_7',
    assetSrc: '/assets/frames/level-7.png',
    minXp: 530,
    nextLevelXp: 700,
    isMax: false,
    holeDiameterRatio: 0.4961,
    aspectSpanRatio: 1.055,
    shortLabelAr: 'المستوى 7',
    shortLabelEn: 'Lv. 7',
    titleAr: 'المستوى 7 — إكليل الغار',
    titleEn: 'Level 7 — Laurel Honor',
    descAr: 'إكليل غار ذهبي متوج بالألماس رمزًا للانضباط الرفيع',
    descEn: 'Diamond-crowned golden laurel wreath symbolizing high discipline',
    accentHex: '#D97706',
  },
  8: {
    level: 8,
    frameId: 'level_8',
    assetSrc: '/assets/frames/level-8.png',
    minXp: 700,
    nextLevelXp: 900,
    isMax: false,
    holeDiameterRatio: 0.4405,
    aspectSpanRatio: 1.0,
    shortLabelAr: 'المستوى 8',
    shortLabelEn: 'Lv. 8',
    titleAr: 'المستوى 8 — تاج الإشراق',
    titleEn: 'Level 8 — Sunburst Crown',
    descAr: 'هالة شمسية ذهبية مرصعة بالياقوت الأزرق للتميز المتواصل',
    descEn: 'Radiant golden sunburst set with sapphires for sustained excellence',
    accentHex: '#0284C7',
  },
  9: {
    level: 9,
    frameId: 'level_9',
    assetSrc: '/assets/frames/level-9.png',
    minXp: 900,
    nextLevelXp: 1150,
    isMax: false,
    holeDiameterRatio: 0.4298,
    aspectSpanRatio: 1.158,
    shortLabelAr: 'المستوى 9',
    shortLabelEn: 'Lv. 9',
    titleAr: 'المستوى 9 — نخبة الأبطال',
    titleEn: 'Level 9 — Imperial Elite',
    descAr: 'إكليل إمبراطوري أرجواني وذهبي لصفوة الطلاب المتفوقين',
    descEn: 'Imperial amethyst and gold laurel reserved for top-tier scholars',
    accentHex: '#6D28D9',
  },
  10: {
    level: 10,
    frameId: 'level_10',
    assetSrc: '/assets/frames/level-10.png',
    minXp: 1150,
    nextLevelXp: null,
    isMax: true,
    holeDiameterRatio: 0.2928,
    aspectSpanRatio: 1.259,
    shortLabelAr: 'المستوى MAX',
    shortLabelEn: 'Lv. MAX',
    titleAr: 'المستوى الأقصى MAX — أسطورة التميز',
    titleEn: 'Level MAX — Celestial Legend',
    descAr: 'أعلى مراتب التفوق: أجنحة سماوية متوجة بالذهب والياقوت',
    descEn: 'Ultimate pinnacle of achievement: celestial wings crowned in gold and sapphire',
    accentHex: '#0284C7',
  },
};

export const ORDERED_LEVEL_DEFINITIONS: LevelFrameDefinition[] = [
  LEVEL_FRAME_DEFINITIONS[1],
  LEVEL_FRAME_DEFINITIONS[2],
  LEVEL_FRAME_DEFINITIONS[3],
  LEVEL_FRAME_DEFINITIONS[4],
  LEVEL_FRAME_DEFINITIONS[5],
  LEVEL_FRAME_DEFINITIONS[6],
  LEVEL_FRAME_DEFINITIONS[7],
  LEVEL_FRAME_DEFINITIONS[8],
  LEVEL_FRAME_DEFINITIONS[9],
  LEVEL_FRAME_DEFINITIONS[10],
];

export const BEHAVIOR_STANDING_LABELS: Record<
  StudentBehaviorStanding,
  { ar: string; en: string }
> = {
  exemplary: { ar: 'سلوك متميز', en: 'Exemplary' },
  positive: { ar: 'متفاعل بإيجابية', en: 'Positive' },
  steady: { ar: 'منتظم', en: 'Steady' },
  needs_attention: { ar: 'يحتاج متابعة', en: 'Needs Follow-up' },
};

export interface StudentProgressionSummary {
  studentId: string;
  level: StudentProgressionLevel;
  frameId: LevelFrameId;
  frameDef: LevelFrameDefinition;
  isMaxLevel: boolean;
  totalXp: number;
  attendanceXp: number;
  behaviorXp: number;
  homeworkXp: number;
  bonusXp: number;
  currentLevelMinXp: number;
  nextLevelMinXp: number | null;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  xpRemainingToNextLevel: number;
  progressPercent: number;
  behaviorStanding: StudentBehaviorStanding;
  behaviorStandingAr: string;
  behaviorStandingEn: string;
  presentOrLateCount: number;
  chargedAbsentCount: number;
  positiveBehaviorCount: number;
  negativeBehaviorCount: number;
  completedHomeworkCount: number;
}

export function levelFromXp(xp: number): StudentProgressionLevel {
  const safeXp = Math.max(0, Math.round(Number(xp) || 0));
  for (let lv = 10 as StudentProgressionLevel; lv >= 1; lv = (lv - 1) as StudentProgressionLevel) {
    if (safeXp >= LEVEL_FRAME_DEFINITIONS[lv].minXp) {
      return lv;
    }
  }
  return 1;
}

export function frameIdToLevel(frameId: LevelFrameId): StudentProgressionLevel {
  const num = Number(frameId.replace('level_', ''));
  if (num >= 1 && num <= 10) {
    return num as StudentProgressionLevel;
  }
  return 1;
}

/**
 * Maps explicit manual or legacy frame identifiers to one of the 10 custom uploaded frames.
 * Returns null for 'auto', 'none', 'default', or empty values so callers know to use
 * the student's live earned Level 1..Max frame.
 */
export function normalizeManualOrLegacyFrame(
  rawFrame?: AchievementFrame | string | null
): LevelFrameId | null {
  if (!rawFrame) return null;
  const clean = String(rawFrame).trim().toLowerCase();
  if (!clean || clean === 'auto' || clean === 'none' || clean === 'default') {
    return null;
  }

  switch (clean) {
    case 'level_1':
      return 'level_1';
    case 'level_2':
    case 'silver':
    case 'silver_scholar':
      return 'level_2';
    case 'level_3':
    case 'bronze_star':
      return 'level_3';
    case 'level_4':
    case 'gold':
    case 'gold_champion':
      return 'level_4';
    case 'level_5':
    case 'story':
    case 'diamond_elite':
      return 'level_5';
    case 'level_6':
    case 'platinum':
      return 'level_6';
    case 'level_7':
    case 'nature':
    case 'emerald_honor':
      return 'level_7';
    case 'level_8':
    case 'challenge':
      return 'level_8';
    case 'level_9':
    case 'cosmic':
    case 'star':
      return 'level_9';
    case 'level_10':
    case 'level_max':
    case 'vip':
    case 'crown':
    case 'champion':
      return 'level_10';
    default:
      return null;
  }
}

export function getLevelDefinitionByFrame(
  frame?: AchievementFrame | string | null
): LevelFrameDefinition {
  const manual = normalizeManualOrLegacyFrame(frame);
  if (manual) {
    return LEVEL_FRAME_DEFINITIONS[frameIdToLevel(manual)];
  }
  return LEVEL_FRAME_DEFINITIONS[1];
}

export function computeProgressionSummaryFromRecords(
  studentId: string,
  attendanceRecords: Attendance[],
  behaviorLogs: StudentBehaviorLog[],
  homeworkAssignments: HomeworkAssignment[],
  cancelledSessionIds: Set<string>,
  bonusPoints: number = 0
): StudentProgressionSummary {
  let attendanceXp = 0;
  let behaviorXp = 0;
  let homeworkXp = 0;

  let presentOrLateCount = 0;
  let chargedAbsentCount = 0;
  let positiveBehaviorCount = 0;
  let negativeBehaviorCount = 0;
  let completedHomeworkCount = 0;

  for (let i = 0; i < attendanceRecords.length; i++) {
    const att = attendanceRecords[i];
    if (cancelledSessionIds.has(att.sessionId)) continue;

    const unitScale = Math.min(2, Math.max(1, Number(att.sessionUnits) || 1));

    if (att.status === 'present') {
      attendanceXp += Math.round(15 * unitScale);
      presentOrLateCount++;
    } else if (att.status === 'late') {
      attendanceXp += Math.round(8 * unitScale);
      presentOrLateCount++;
    } else if (
      att.status === 'absent_charged' ||
      (att.status === 'absent' && att.isCharged !== false)
    ) {
      attendanceXp -= 10;
      chargedAbsentCount++;
    }

    if (att.behaviorRating === 'excellent') {
      behaviorXp += 15;
      positiveBehaviorCount++;
    } else if (att.behaviorRating === 'very_good') {
      behaviorXp += 10;
      positiveBehaviorCount++;
    } else if (att.behaviorRating === 'good') {
      behaviorXp += 5;
    } else if (att.behaviorRating === 'needs_improvement') {
      behaviorXp -= 8;
      negativeBehaviorCount++;
    }

    if (att.homeworkRating === 'completed') {
      homeworkXp += 12;
      completedHomeworkCount++;
    } else if (att.homeworkRating === 'partially_completed') {
      homeworkXp += 6;
    } else if (att.homeworkRating === 'incomplete') {
      homeworkXp -= 5;
    } else if (att.homeworkRating === 'not_submitted') {
      homeworkXp -= 8;
    } else if (
      att.homeworkDone !== undefined &&
      (att.status === 'present' || att.status === 'late')
    ) {
      if (att.homeworkDone) {
        homeworkXp += 6;
        completedHomeworkCount++;
      } else {
        homeworkXp -= 4;
      }
    }
  }

  for (let i = 0; i < behaviorLogs.length; i++) {
    const log = behaviorLogs[i];
    const rawPts =
      log.points !== undefined && log.points !== null
        ? Number(log.points)
        : log.category === 'positive'
        ? 8
        : log.category === 'needs_improvement'
        ? -5
        : 0;

    behaviorXp += Math.round((isNaN(rawPts) ? 0 : rawPts) * 1.5);

    if (log.category === 'positive') {
      positiveBehaviorCount++;
    } else if (log.category === 'needs_improvement') {
      negativeBehaviorCount++;
    }
  }

  for (let i = 0; i < homeworkAssignments.length; i++) {
    const hw = homeworkAssignments[i];
    if (hw.status === 'COMPLETED') {
      const pct = Number(hw.percentage ?? hw.scorePercentage ?? 0);
      homeworkXp += 15 + (pct >= 85 ? 8 : 0);
      completedHomeworkCount++;
    } else if (hw.status === 'EXPIRED') {
      homeworkXp -= 6;
    }
  }

  const bonusXp = Math.round(Number(bonusPoints) || 0);
  const totalXp = Math.max(0, attendanceXp + behaviorXp + homeworkXp + bonusXp);
  const level = levelFromXp(totalXp);
  const frameDef = LEVEL_FRAME_DEFINITIONS[level];

  const currentLevelMinXp = frameDef.minXp;
  const nextLevelMinXp = frameDef.nextLevelXp;
  const xpInCurrentLevel = Math.max(0, totalXp - currentLevelMinXp);
  const xpNeededForNextLevel =
    nextLevelMinXp !== null ? Math.max(1, nextLevelMinXp - currentLevelMinXp) : 0;
  const xpRemainingToNextLevel =
    nextLevelMinXp !== null ? Math.max(0, nextLevelMinXp - totalXp) : 0;
  const progressPercent =
    nextLevelMinXp !== null
      ? Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100)))
      : 100;

  const totalSessionsTracked = presentOrLateCount + chargedAbsentCount;
  const attendanceRate =
    totalSessionsTracked > 0 ? (presentOrLateCount / totalSessionsTracked) * 100 : 100;
  const netBehaviorSignals = positiveBehaviorCount - negativeBehaviorCount;

  let behaviorStanding: StudentBehaviorStanding = 'steady';
  if (
    (negativeBehaviorCount >= 2 && negativeBehaviorCount > positiveBehaviorCount) ||
    (chargedAbsentCount >= 3 && attendanceRate < 60)
  ) {
    behaviorStanding = 'needs_attention';
  } else if (
    (netBehaviorSignals >= 3 && negativeBehaviorCount === 0) ||
    (behaviorXp >= 45 && negativeBehaviorCount <= 1)
  ) {
    behaviorStanding = 'exemplary';
  } else if (
    netBehaviorSignals >= 1 ||
    (presentOrLateCount >= 2 && attendanceRate >= 85 && negativeBehaviorCount === 0)
  ) {
    behaviorStanding = 'positive';
  }

  return {
    studentId,
    level,
    frameId: frameDef.frameId,
    frameDef,
    isMaxLevel: frameDef.isMax,
    totalXp,
    attendanceXp,
    behaviorXp,
    homeworkXp,
    bonusXp,
    currentLevelMinXp,
    nextLevelMinXp,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    xpRemainingToNextLevel,
    progressPercent,
    behaviorStanding,
    behaviorStandingAr: BEHAVIOR_STANDING_LABELS[behaviorStanding].ar,
    behaviorStandingEn: BEHAVIOR_STANDING_LABELS[behaviorStanding].en,
    presentOrLateCount,
    chargedAbsentCount,
    positiveBehaviorCount,
    negativeBehaviorCount,
    completedHomeworkCount,
  };
}

let cachedCacheToken = '';
let cachedProgressionMap = new Map<string, StudentProgressionSummary>();

function ensureProgressionCache(): Map<string, StudentProgressionSummary> {
  const rev = db.getDomainRevision();
  const students = db.getStudents();
  const userScope = students[0]?.userId || 'default';
  const token = `${rev}:${students.length}:${userScope}`;

  if (cachedCacheToken === token) {
    return cachedProgressionMap;
  }

  const allSessions: Session[] = db.getSessions();
  const cancelledSessionIds = new Set<string>();
  for (let i = 0; i < allSessions.length; i++) {
    if (allSessions[i].status === 'cancelled') {
      cancelledSessionIds.add(allSessions[i].id);
    }
  }

  const allAttendance = db.getAttendance();
  const attByStudent = new Map<string, Attendance[]>();
  for (let i = 0; i < allAttendance.length; i++) {
    const a = allAttendance[i];
    const arr = attByStudent.get(a.studentId);
    if (arr) arr.push(a);
    else attByStudent.set(a.studentId, [a]);
  }

  const allBehavior = db.getBehaviorLogs();
  const behByStudent = new Map<string, StudentBehaviorLog[]>();
  for (let i = 0; i < allBehavior.length; i++) {
    const b = allBehavior[i];
    const arr = behByStudent.get(b.studentId);
    if (arr) arr.push(b);
    else behByStudent.set(b.studentId, [b]);
  }

  const allHw = db.getHomeworkAssignments();
  const hwByStudent = new Map<string, HomeworkAssignment[]>();
  for (let i = 0; i < allHw.length; i++) {
    const h = allHw[i];
    const arr = hwByStudent.get(h.studentId);
    if (arr) arr.push(h);
    else hwByStudent.set(h.studentId, [h]);
  }

  const nextMap = new Map<string, StudentProgressionSummary>();
  for (let i = 0; i < students.length; i++) {
    const st = students[i];
    nextMap.set(
      st.id,
      computeProgressionSummaryFromRecords(
        st.id,
        attByStudent.get(st.id) || [],
        behByStudent.get(st.id) || [],
        hwByStudent.get(st.id) || [],
        cancelledSessionIds,
        st.levelBonusPoints || 0
      )
    );
  }

  cachedCacheToken = token;
  cachedProgressionMap = nextMap;
  return nextMap;
}

const DEFAULT_STARTER_PROGRESSION: StudentProgressionSummary =
  computeProgressionSummaryFromRecords('temp', [], [], [], new Set(), 0);

/**
 * O(1) lookup of a student's real-time Level 1..Max & Behavior progression summary.
 */
export function getStudentProgression(
  studentOrId?: { id?: string; levelBonusPoints?: number } | string | null
): StudentProgressionSummary {
  if (!studentOrId) return DEFAULT_STARTER_PROGRESSION;
  const id = typeof studentOrId === 'string' ? studentOrId : studentOrId.id;
  if (!id || id === 'temp') return DEFAULT_STARTER_PROGRESSION;

  const map = ensureProgressionCache();
  return map.get(id) || DEFAULT_STARTER_PROGRESSION;
}

/**
 * Resolves the exact custom LevelFrameId ('level_1'..'level_10') to render for a student.
 * - If explicitFrameProp is provided as a specific manual/preview frame ('level_1'..'level_10' or legacy),
 *   returns that frame (used by AchievementFrameSelector previews and manual overrides).
 * - If 'auto', 'none', 'default', or omitted, returns the student's live earned Level 1..Max frame!
 */
export function resolveStudentLevelFrame(
  student?: {
    id?: string;
    achievementFrame?: AchievementFrame | null;
    avatarFrameMode?: 'auto' | 'manual';
  } | null,
  explicitFrameProp?: AchievementFrame | null
): LevelFrameId {
  // 1. Explicit preview or prop override
  if (explicitFrameProp !== undefined && explicitFrameProp !== null) {
    if (
      explicitFrameProp === 'auto' ||
      explicitFrameProp === 'none' ||
      explicitFrameProp === 'default'
    ) {
      return getStudentProgression(student).frameId;
    }
    const normalizedProp = normalizeManualOrLegacyFrame(explicitFrameProp);
    if (normalizedProp) return normalizedProp;
  }

  // 2. Student's stored manual override (unless mode is explicitly 'auto')
  if (student && student.avatarFrameMode !== 'auto') {
    const manualStored = normalizeManualOrLegacyFrame(student.achievementFrame);
    if (manualStored) return manualStored;
  }

  // 3. Default: Automatic Level 1 -> Level Max progression from real student records
  return getStudentProgression(student).frameId;
}

/**
 * Previews how a behavior log point delta will affect a student's XP & Level.
 */
export function previewBehaviorPointsImpact(
  studentOrId: { id?: string } | string | null | undefined,
  rawPoints: number
): {
  xpDelta: number;
  projectedXp: number;
  currentLevel: StudentProgressionLevel;
  projectedLevel: StudentProgressionLevel;
  leveledUp: boolean;
  leveledDown: boolean;
  projectedFrameDef: LevelFrameDefinition;
} {
  const current = getStudentProgression(studentOrId);
  const xpDelta = Math.round((Number(rawPoints) || 0) * 1.5);
  const projectedXp = Math.max(0, current.totalXp + xpDelta);
  const projectedLevel = levelFromXp(projectedXp);

  return {
    xpDelta,
    projectedXp,
    currentLevel: current.level,
    projectedLevel,
    leveledUp: projectedLevel > current.level,
    leveledDown: projectedLevel < current.level,
    projectedFrameDef: LEVEL_FRAME_DEFINITIONS[projectedLevel],
  };
}

/**
 * Maps a 0-100 progress percentage to a static Tailwind width utility class (zero inline styles).
 */
const PROGRESS_WIDTH_CLASSES: readonly string[] = [
  'w-0',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-1/2',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-3/4',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
];

export function getProgressWidthClass(percent: number): string {
  const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
  if (clamped > 0 && clamped < 5) return 'w-[5%]';
  const bucket = Math.round(clamped / 5);
  return PROGRESS_WIDTH_CLASSES[bucket] || 'w-0';
}
