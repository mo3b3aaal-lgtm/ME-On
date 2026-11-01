import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  Attendance,
  AttendanceStatus,
  Enrollment,
  Group,
  GroupFinancialSummary,
  ReportPeriodFilter,
  Session,
  SessionStatus,
  Student,
  StudentGrandFinancialSummary,
  TeacherProfile,
  getBehaviorRatingLabel,
  getHomeworkRatingLabel,
} from '../types';
import { formatSessionQuantityDisplay, getSessionLessonQuantity, roundMoney } from './storage';
import { formatTimeDisplay, isEnrollmentActiveOnDate } from './schedule';
import { getLocalizedStageName } from './stages';
import { getStudentProgression } from './studentProgression';
import { parseLocalDateStr, toLocalISODate } from './localDate';

export type ReportExportScope = 'student' | 'group' | 'overview';
export type ReportExportFormat = 'pdf' | 'csv';

export const REPORT_MIME_TYPES: Record<ReportExportFormat, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
};

export interface NativeSaveFileOptions {
  filename: string;
  base64Data: string;
  mimeType: string;
  title?: string;
  text?: string;
}

export interface NativeSaveFileResult {
  saved: boolean;
  shared?: boolean;
  cancelled?: boolean;
  method: string;
  uri?: string;
  filename: string;
  bytesWritten?: number;
  locationLabel?: string;
}

export interface ReportFileSaverPlugin {
  saveToDownloads(options: NativeSaveFileOptions): Promise<NativeSaveFileResult>;
  shareFile(options: NativeSaveFileOptions): Promise<NativeSaveFileResult>;
}

const ReportFileSaver = registerPlugin<ReportFileSaverPlugin>('ReportFileSaver');

export type ReportSaveOutcomeStatus =
  | 'saved_to_downloads'
  | 'saved_to_device'
  | 'browser_downloaded'
  | 'shared'
  | 'cancelled';

export interface ReportSaveResult {
  status: ReportSaveOutcomeStatus;
  filename: string;
  mimeType: string;
  uri?: string;
  method:
    | 'mediastore_downloads'
    | 'saf_create_document'
    | 'android_sharesheet'
    | 'web_share'
    | 'browser_anchor'
    | 'cancelled';
}

export type ReportSaveErrorCode =
  | 'EMPTY_REPORT_BLOB'
  | 'BASE64_ENCODING_FAILED'
  | 'WEBVIEW_SAVE_UNSUPPORTED'
  | 'STORAGE_WRITE_FAILED';

export class ReportSaveError extends Error {
  readonly code: ReportSaveErrorCode;

  constructor(code: ReportSaveErrorCode, message: string) {
    super(message);
    this.name = 'ReportSaveError';
    this.code = code;
  }
}

export interface ReportRuntimeEnvironment {
  isCapacitorNativeAndroid: boolean;
  isCapacitorNativeIOS: boolean;
  hasNativeReportSaverPlugin: boolean;
  isEmbeddedAndroidWebView: boolean;
}

export interface ReportExportFinancialSnapshot {
  totalDue: number;
  totalPaid: number;
  remaining: number;
  currency: string;
}

export interface ReportExportOptions {
  scope: ReportExportScope;
  periodFilter: ReportPeriodFilter;
  periodLabel: string;
  todayStr: string;
  currentMonth: number;
  currentYear: number;
  selectedSpecificMonth: number;
  selectedSpecificYear: number;
  customStartDate?: string;
  customEndDate?: string;
  serviceTypeFilter?: 'all' | 'group' | 'private';
  studentId?: string;
  groupId?: string;
  includeFinancials: boolean;
  isEn: boolean;
  currencyLabel: string;
  students: Student[];
  groups: Group[];
  sessions: Session[];
  enrollments: Enrollment[];
  attendance: Attendance[];
  teacherProfile?: TeacherProfile | null;
  studentFinancials?: StudentGrandFinancialSummary | null;
  groupFinancials?: GroupFinancialSummary | null;
  overviewFinancials?: {
    totalDue: number;
    totalCollected: number;
    totalRemaining: number;
  } | null;
}

export interface AttendanceExportRow {
  id: string;
  date: string;
  dayLabel: string;
  startTime: string;
  rawStartTime: string;
  studentName: string;
  serviceName: string;
  lessonType: 'group' | 'private';
  lessonTypeLabel: string;
  sessionTitle: string;
  sessionStatus: SessionStatus;
  sessionStatusLabel: string;
  attendanceStatus: AttendanceStatus | 'unrecorded';
  attendanceStatusLabel: string;
  quantityLabel: string;
  unitFactor: number;
  homeworkCompleted: boolean;
  homeworkLabel: string;
  behaviorLabel: string;
  quizScoreLabel: string;
  notes: string;
}

export interface AttendanceExportSummary {
  totalSessions: number;
  completedSessions: number;
  scheduledSessions: number;
  cancelledSessions: number;
  totalRows: number;
  presentCount: number;
  lateCount: number;
  absentChargedCount: number;
  absentExcusedCount: number;
  unrecordedCount: number;
  commitmentRate: number;
  homeworkCompletedCount: number;
}

export interface AttendanceExportDataset {
  scope: ReportExportScope;
  isEn: boolean;
  reportTitle: string;
  targetTitle: string;
  targetSubtitle: string;
  parentLine: string;
  teacherLine: string;
  periodLabel: string;
  exportedAtDate: string;
  suggestedBaseFilename: string;
  includeFinancials: boolean;
  financials: ReportExportFinancialSnapshot | null;
  summary: AttendanceExportSummary;
  rows: AttendanceExportRow[];
}

function computeSevenDaysAgoStr(todayStr: string): string {
  const base = parseLocalDateStr(todayStr);
  base.setDate(base.getDate() - 7);
  return toLocalISODate(base);
}

export function doesSessionMatchReportPeriod(
  session: Session,
  opts: Pick<
    ReportExportOptions,
    | 'periodFilter'
    | 'todayStr'
    | 'currentMonth'
    | 'currentYear'
    | 'selectedSpecificMonth'
    | 'selectedSpecificYear'
    | 'customStartDate'
    | 'customEndDate'
  >
): boolean {
  const {
    periodFilter,
    todayStr,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
    customStartDate,
    customEndDate,
  } = opts;

  if (periodFilter === 'all_time') return true;
  if (periodFilter === 'today') return session.date === todayStr;
  if (periodFilter === 'last_7_days' || periodFilter === 'this_week') {
    const d7Str = computeSevenDaysAgoStr(todayStr);
    return session.date >= d7Str && session.date <= todayStr;
  }
  if (periodFilter === 'this_month') {
    return session.month === currentMonth && session.year === currentYear;
  }
  if (periodFilter === 'last_month') {
    const lastM = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastY = currentMonth === 1 ? currentYear - 1 : currentYear;
    return session.month === lastM && session.year === lastY;
  }
  if (periodFilter === 'specific_month') {
    return session.month === selectedSpecificMonth && session.year === selectedSpecificYear;
  }
  if (periodFilter === 'custom_range') {
    if (customStartDate && customEndDate) {
      return session.date >= customStartDate && session.date <= customEndDate;
    }
    if (customStartDate) return session.date >= customStartDate;
    if (customEndDate) return session.date <= customEndDate;
  }
  return true;
}

function isPrivateSessionEntity(session: Session, group?: Group): boolean {
  return Boolean(
    session.studentId ||
      group?.type === 'private' ||
      (session.groupId && session.groupId.startsWith('private_'))
  );
}

function getSessionUnitFactor(
  session: Session,
  att: Attendance | undefined,
  group: Group | undefined,
  enrollments: Enrollment[]
): number {
  const isPrivate = isPrivateSessionEntity(session, group);
  if (!isPrivate) return 1;

  const enr = enrollments.find(
    (e) =>
      e.id === session.enrollmentId ||
      (att?.enrollmentId && e.id === att.enrollmentId) ||
      (session.studentId && e.studentId === session.studentId && e.groupId === session.groupId)
  );
  const isHourly =
    session.isHourly === true ||
    session.billingMode === 'hourly' ||
    enr?.billingMode === 'hourly' ||
    enr?.billingType === 'hourly' ||
    group?.billingMode === 'hourly' ||
    group?.billingType === 'hourly' ||
    (session.hours !== undefined &&
      Number(session.hours) > 0 &&
      !session.sessionUnits &&
      !att?.sessionUnits);

  if (isHourly) return 1;
  return getSessionLessonQuantity(session, att ?? null);
}

function getSessionStatusLabel(status: SessionStatus, isEn: boolean): string {
  switch (status) {
    case 'completed':
      return isEn ? 'Completed' : 'منفذة';
    case 'scheduled':
      return isEn ? 'Scheduled' : 'مجدولة';
    case 'cancelled':
      return isEn ? 'Cancelled' : 'ملغاة';
    default:
      return status;
  }
}

function getAttendanceStatusLabel(
  status: AttendanceStatus | 'unrecorded',
  isCharged: boolean | undefined,
  sessionStatus: SessionStatus,
  isEn: boolean
): string {
  if (status === 'unrecorded') {
    if (sessionStatus === 'cancelled') return isEn ? 'Cancelled' : 'حصة ملغاة';
    if (sessionStatus === 'scheduled') return isEn ? 'Upcoming' : 'مجدولة';
    return isEn ? 'Unrecorded' : 'لم يُرصد';
  }
  switch (status) {
    case 'present':
      return isEn ? 'Present' : 'حاضر';
    case 'late':
      return isEn ? 'Late' : 'متأخر';
    case 'absent_charged':
      return isEn ? 'Absent (Charged)' : 'غائب (محسوب)';
    case 'absent_free':
    case 'excused':
      return isEn ? 'Excused' : 'معتذر / معفى';
    case 'absent':
      return isCharged === false
        ? isEn
          ? 'Excused'
          : 'معتذر / معفى'
        : isEn
        ? 'Absent (Charged)'
        : 'غائب (محسوب)';
    default:
      return status;
  }
}

function buildCombinedNotes(session: Session, att?: Attendance, isEn = false): string {
  const parts: string[] = [];
  if (att?.absenceReason?.trim()) {
    parts.push(
      isEn ? `Reason: ${att.absenceReason.trim()}` : `السبب: ${att.absenceReason.trim()}`
    );
  }
  if (att?.notes?.trim()) {
    parts.push(att.notes.trim());
  }
  if (session.notes?.trim() && session.notes.trim() !== att?.notes?.trim()) {
    parts.push(session.notes.trim());
  }
  return parts.join(' · ');
}

export function sanitizeFilenameSegment(raw: string): string {
  const normalized = typeof raw.normalize === 'function' ? raw.normalize('NFC') : raw;
  const cleaned = normalized
    .trim()
    .replace(/[\u0000-\u001F\u007F\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 48);
  return cleaned || 'Report';
}

export function buildReportFilename(baseFilename: string, format: ReportExportFormat): string {
  const ext = format === 'csv' ? 'csv' : 'pdf';
  const normalized =
    typeof baseFilename.normalize === 'function' ? baseFilename.normalize('NFC') : baseFilename;
  const strippedExt = normalized.trim().replace(/\.(pdf|csv)$/i, '');
  const safeBase = strippedExt
    .replace(/[\u0000-\u001F\u007F\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return `${safeBase || 'Classy_Report'}.${ext}`;
}

export function buildAttendanceExportDataset(
  options: ReportExportOptions
): AttendanceExportDataset {
  const {
    scope,
    periodLabel,
    todayStr,
    serviceTypeFilter = 'all',
    studentId,
    groupId,
    includeFinancials,
    isEn,
    currencyLabel,
    students,
    groups,
    sessions,
    enrollments,
    attendance,
    teacherProfile,
    studentFinancials,
    groupFinancials,
    overviewFinancials,
  } = options;

  const studentsById = new Map(students.map((s) => [s.id, s]));
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  const periodSessions = sessions.filter((s) => doesSessionMatchReportPeriod(s, options));

  const attBySessionId = new Map<string, Attendance[]>();
  for (const att of attendance) {
    const list = attBySessionId.get(att.sessionId);
    if (list) list.push(att);
    else attBySessionId.set(att.sessionId, [att]);
  }

  const rows: AttendanceExportRow[] = [];
  const matchedSessionsMap = new Map<string, Session>();

  const createRow = (
    session: Session,
    att: Attendance | undefined,
    resolvedStudent: Student | undefined,
    fallbackStudentLabel: string
  ): AttendanceExportRow => {
    const group = session.groupId ? groupsById.get(session.groupId) : undefined;
    const isPrivate = isPrivateSessionEntity(session, group);
    const enrollment = enrollments.find(
      (e) =>
        e.id === (att?.enrollmentId || session.enrollmentId) ||
        (resolvedStudent && e.studentId === resolvedStudent.id && e.groupId === session.groupId)
    );

    const serviceName = isPrivate
      ? enrollment?.subject ||
        resolvedStudent?.subject ||
        group?.subject ||
        group?.name ||
        session.title ||
        (isEn ? 'Private Lesson' : 'درس خاص')
      : group?.name || session.title || (isEn ? 'Study Group' : 'مجموعة دراسية');

    const quantityLabel = formatSessionQuantityDisplay(
      {
        sessionUnits: att?.sessionUnits ?? session.sessionUnits,
        hours: att?.hours ?? session.hours,
        billingMode:
          att?.billingModeSnapshot ??
          session.billingMode ??
          enrollment?.billingMode ??
          group?.billingMode,
        billingType:
          att?.billingTypeSnapshot ??
          session.billingTypeSnapshot ??
          enrollment?.billingType ??
          group?.billingType,
        isHourly: session.isHourly,
      },
      !isEn
    );

    const unitFactor = getSessionUnitFactor(session, att, group, enrollments);
    const attStatus: AttendanceStatus | 'unrecorded' = att ? att.status : 'unrecorded';

    const homeworkRatingText = getHomeworkRatingLabel(att?.homeworkRating, isEn);
    const homeworkCompleted =
      att?.homeworkRating === 'completed' ||
      (att?.homeworkRating === undefined && att?.homeworkDone === true);
    const homeworkLabel = homeworkRatingText
      ? homeworkRatingText
      : att?.homeworkDone === true
      ? isEn
        ? 'Completed'
        : 'مكتمل'
      : att?.homeworkDone === false
      ? isEn
        ? 'Incomplete'
        : 'غير مكتمل'
      : '—';

    const behaviorText = getBehaviorRatingLabel(att?.behaviorRating, isEn);
    const behaviorLabel = behaviorText || '—';
    const quizScoreLabel =
      att?.quizScore !== undefined && att?.quizScore !== null ? String(att.quizScore) : '—';

    return {
      id: att ? `${session.id}_${att.id}` : session.id,
      date: session.date,
      dayLabel: session.dayName || session.date,
      startTime: session.startTime ? formatTimeDisplay(session.startTime) : '—',
      rawStartTime: session.startTime || '00:00',
      studentName: resolvedStudent?.name || fallbackStudentLabel,
      serviceName,
      lessonType: isPrivate ? 'private' : 'group',
      lessonTypeLabel: isPrivate ? (isEn ? 'Private' : 'درس خاص') : isEn ? 'Group' : 'مجموعة',
      sessionTitle: session.title || serviceName,
      sessionStatus: session.status,
      sessionStatusLabel: getSessionStatusLabel(session.status, isEn),
      attendanceStatus: attStatus,
      attendanceStatusLabel: getAttendanceStatusLabel(
        attStatus,
        att?.isCharged,
        session.status,
        isEn
      ),
      quantityLabel,
      unitFactor,
      homeworkCompleted,
      homeworkLabel,
      behaviorLabel,
      quizScoreLabel,
      notes: buildCombinedNotes(session, att, isEn),
    };
  };

  let reportTitle = isEn
    ? 'Sessions & Attendance Report'
    : 'تقرير الحصص والحضور الشامل';
  let targetTitle = isEn ? 'All Classes & Private Lessons' : 'كافة المجموعات والدروس الخاصة';
  let targetSubtitle = '';
  let parentLine = '';
  let financials: ReportExportFinancialSnapshot | null = null;
  let filenameContext = 'all_sessions';

  if (scope === 'student') {
    const targetStudent = studentId ? studentsById.get(studentId) : students[0];
    reportTitle = isEn
      ? 'Parent Session & Attendance Report'
      : 'تقرير متابعة الحصص والحضور لولي الأمر';

    if (targetStudent) {
      filenameContext = targetStudent.name;
      targetTitle = targetStudent.name;
      const prog = getStudentProgression(targetStudent);
      const stageText = targetStudent.gradeLevel
        ? getLocalizedStageName(targetStudent.gradeLevel)
        : '';
      const levelText = isEn ? prog.frameDef.shortLabelEn : prog.frameDef.shortLabelAr;
      const standingText = isEn ? prog.behaviorStandingEn : prog.behaviorStandingAr;
      targetSubtitle = [stageText, levelText, standingText].filter(Boolean).join(' · ');

      if (targetStudent.parentName || targetStudent.parentPhone) {
        const pLabel = targetStudent.parentName || (isEn ? 'Parent / Guardian' : 'ولي الأمر');
        const pPhone = targetStudent.parentPhone ? ` (${targetStudent.parentPhone})` : '';
        parentLine = isEn ? `Prepared for: ${pLabel}${pPhone}` : `موجّه إلى: ${pLabel}${pPhone}`;
      }

      const studentEnrs = enrollments.filter((e) => e.studentId === targetStudent.id);
      const enrByGroupId = new Map<string, Enrollment>();
      for (const e of studentEnrs) {
        if (!enrByGroupId.has(e.groupId) || e.status === 'active') {
          enrByGroupId.set(e.groupId, e);
        }
      }

      for (const session of periodSessions) {
        const sessionAtts = attBySessionId.get(session.id) || [];
        const studentAtt = sessionAtts.find((a) => a.studentId === targetStudent.id);

        if (studentAtt) {
          matchedSessionsMap.set(session.id, session);
          rows.push(createRow(session, studentAtt, targetStudent, targetStudent.name));
          continue;
        }

        if (session.studentId === targetStudent.id) {
          const privEnr = session.enrollmentId
            ? studentEnrs.find((e) => e.id === session.enrollmentId)
            : enrByGroupId.get(session.groupId);
          if (
            session.status === 'completed' ||
            isEnrollmentActiveOnDate(privEnr, session.date, targetStudent)
          ) {
            matchedSessionsMap.set(session.id, session);
            rows.push(createRow(session, undefined, targetStudent, targetStudent.name));
          }
          continue;
        }

        if (!session.studentId && session.groupId && enrByGroupId.has(session.groupId)) {
          const grpEnr = enrByGroupId.get(session.groupId);
          if (isEnrollmentActiveOnDate(grpEnr, session.date, targetStudent)) {
            matchedSessionsMap.set(session.id, session);
            rows.push(createRow(session, undefined, targetStudent, targetStudent.name));
          }
        }
      }

      if (includeFinancials && studentFinancials) {
        financials = {
          totalDue: roundMoney(studentFinancials.grandTotalDue, 2),
          totalPaid: roundMoney(studentFinancials.grandTotalPaid, 2),
          remaining: roundMoney(studentFinancials.grandRemaining, 2),
          currency: currencyLabel,
        };
      }
    }
  } else if (scope === 'group') {
    const targetGroup = groupId ? groupsById.get(groupId) : groups[0];
    reportTitle = isEn ? 'Group Session & Attendance Report' : 'تقرير حصص وحضور المجموعة';

    if (targetGroup) {
      filenameContext = targetGroup.name;
      targetTitle = targetGroup.name;
      const stageText = targetGroup.gradeLevel ? getLocalizedStageName(targetGroup.gradeLevel) : '';
      targetSubtitle = [
        targetGroup.subject,
        stageText,
        targetGroup.type === 'private'
          ? isEn
            ? 'Private Service'
            : 'خدمة درس خاص'
          : isEn
          ? 'Study Group'
          : 'مجموعة دراسية',
      ]
        .filter(Boolean)
        .join(' · ');

      const groupSessions = periodSessions.filter((s) => s.groupId === targetGroup.id);
      for (const session of groupSessions) {
        matchedSessionsMap.set(session.id, session);
        const sessionAtts = attBySessionId.get(session.id) || [];
        if (sessionAtts.length > 0) {
          const sortedAtts = [...sessionAtts].sort((a, b) => {
            const nameA = studentsById.get(a.studentId)?.name || '';
            const nameB = studentsById.get(b.studentId)?.name || '';
            return nameA.localeCompare(nameB, isEn ? 'en' : 'ar');
          });
          for (const att of sortedAtts) {
            const st = studentsById.get(att.studentId);
            rows.push(
              createRow(
                session,
                att,
                st,
                isEn ? 'Registered Student' : 'طالب مسجل'
              )
            );
          }
        } else {
          const st = session.studentId ? studentsById.get(session.studentId) : undefined;
          rows.push(
            createRow(
              session,
              undefined,
              st,
              isEn ? 'All Group Students' : 'طلاب المجموعة'
            )
          );
        }
      }

      if (includeFinancials && groupFinancials) {
        financials = {
          totalDue: roundMoney(
            Number(groupFinancials.totalDue ?? groupFinancials.totalExpectedRevenue) || 0,
            2
          ),
          totalPaid: roundMoney(
            Number(groupFinancials.totalPaid ?? groupFinancials.totalRevenue) || 0,
            2
          ),
          remaining: roundMoney(
            Number(groupFinancials.remaining ?? groupFinancials.totalRemainingDues) || 0,
            2
          ),
          currency: currencyLabel,
        };
      }
    }
  } else {
    reportTitle = isEn
      ? 'Comprehensive Sessions & Attendance Report'
      : 'تقرير الحصص والحضور الشامل';
    targetSubtitle =
      serviceTypeFilter === 'group'
        ? isEn
          ? 'Study Groups Only'
          : 'المجموعات الدراسية فقط'
        : serviceTypeFilter === 'private'
        ? isEn
          ? 'Private Lessons Only'
          : 'الدروس الخاصة فقط'
        : isEn
        ? 'Groups & Private Lessons'
        : 'المجموعات والدروس الخاصة';

    for (const session of periodSessions) {
      const grp = session.groupId ? groupsById.get(session.groupId) : undefined;
      const isPriv = isPrivateSessionEntity(session, grp);
      if (serviceTypeFilter === 'group' && isPriv) continue;
      if (serviceTypeFilter === 'private' && !isPriv) continue;

      matchedSessionsMap.set(session.id, session);
      const sessionAtts = attBySessionId.get(session.id) || [];
      if (sessionAtts.length > 0) {
        for (const att of sessionAtts) {
          const st = studentsById.get(att.studentId);
          rows.push(
            createRow(
              session,
              att,
              st,
              isEn ? 'Registered Student' : 'طالب مسجل'
            )
          );
        }
      } else {
        const st = session.studentId ? studentsById.get(session.studentId) : undefined;
        rows.push(
          createRow(
            session,
            undefined,
            st,
            isPriv
              ? isEn
                ? 'Private Student'
                : 'طالب درس خاص'
              : isEn
              ? 'Group Session'
              : 'حصة مجموعة'
          )
        );
      }
    }

    if (includeFinancials && overviewFinancials) {
      financials = {
        totalDue: roundMoney(Number(overviewFinancials.totalDue) || 0, 2),
        totalPaid: roundMoney(Number(overviewFinancials.totalCollected) || 0, 2),
        remaining: roundMoney(Number(overviewFinancials.totalRemaining) || 0, 2),
        currency: currencyLabel,
      };
    }
  }

  rows.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = b.rawStartTime.localeCompare(a.rawStartTime);
    if (timeCmp !== 0) return timeCmp;
    return a.studentName.localeCompare(b.studentName, isEn ? 'en' : 'ar');
  });

  const uniqueSessions = Array.from(matchedSessionsMap.values());
  const completedSessions = uniqueSessions.filter((s) => s.status === 'completed').length;
  const scheduledSessions = uniqueSessions.filter((s) => s.status === 'scheduled').length;
  const cancelledSessions = uniqueSessions.filter((s) => s.status === 'cancelled').length;

  let presentCount = 0;
  let lateCount = 0;
  let absentChargedCount = 0;
  let absentExcusedCount = 0;
  let unrecordedCount = 0;
  let homeworkCompletedCount = 0;

  for (const row of rows) {
    if (row.homeworkCompleted) homeworkCompletedCount += 1;
    if (row.attendanceStatus === 'present') {
      presentCount += row.unitFactor;
    } else if (row.attendanceStatus === 'late') {
      lateCount += row.unitFactor;
    } else if (
      row.attendanceStatus === 'absent_charged' ||
      row.attendanceStatus === 'absent'
    ) {
      absentChargedCount += row.unitFactor;
    } else if (
      row.attendanceStatus === 'absent_free' ||
      row.attendanceStatus === 'excused'
    ) {
      absentExcusedCount += row.unitFactor;
    } else {
      unrecordedCount += 1;
    }
  }

  presentCount = roundMoney(presentCount, 2);
  lateCount = roundMoney(lateCount, 2);
  absentChargedCount = roundMoney(absentChargedCount, 2);
  absentExcusedCount = roundMoney(absentExcusedCount, 2);

  const totalRecordedUnits = roundMoney(
    presentCount + lateCount + absentChargedCount + absentExcusedCount,
    2
  );
  const commitmentRate =
    totalRecordedUnits > 0
      ? Math.round(((presentCount + lateCount) / totalRecordedUnits) * 100)
      : 100;

  const teacherParts: string[] = [];
  if (teacherProfile?.name?.trim()) {
    teacherParts.push(
      isEn ? `Teacher: ${teacherProfile.name.trim()}` : `المعلم: ${teacherProfile.name.trim()}`
    );
  }
  if (teacherProfile?.subject?.trim()) {
    teacherParts.push(teacherProfile.subject.trim());
  }
  if (teacherProfile?.centerOrSchool?.trim()) {
    teacherParts.push(teacherProfile.centerOrSchool.trim());
  }
  if (teacherProfile?.phone?.trim()) {
    teacherParts.push(teacherProfile.phone.trim());
  }

  const safeSlug = sanitizeFilenameSegment(filenameContext);
  const suggestedBaseFilename =
    scope === 'overview' || filenameContext === 'all_sessions'
      ? `Classy_Report_${todayStr}`
      : `Classy_Report_${safeSlug}_${todayStr}`;

  return {
    scope,
    isEn,
    reportTitle,
    targetTitle,
    targetSubtitle,
    parentLine,
    teacherLine: teacherParts.join(' · '),
    periodLabel,
    exportedAtDate: todayStr,
    suggestedBaseFilename,
    includeFinancials,
    financials,
    summary: {
      totalSessions: uniqueSessions.length,
      completedSessions,
      scheduledSessions,
      cancelledSessions,
      totalRows: rows.length,
      presentCount,
      lateCount,
      absentChargedCount,
      absentExcusedCount,
      unrecordedCount,
      commitmentRate,
      homeworkCompletedCount,
    },
    rows,
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  const guarded =
    /^[=+\-@]/.test(str) && !/^[-+]?\d+(\.\d+)?$/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export function generateAttendanceReportCSV(dataset: AttendanceExportDataset): string {
  const { isEn, summary, financials, rows } = dataset;
  const lines: string[] = [];

  const pushRow = (cells: (string | number)[]) => {
    lines.push(cells.map(escapeCsvCell).join(','));
  };

  pushRow([isEn ? 'Report' : 'التقرير', dataset.reportTitle]);
  pushRow([
    dataset.scope === 'student'
      ? isEn
        ? 'Student'
        : 'الطالب'
      : dataset.scope === 'group'
      ? isEn
        ? 'Group'
        : 'المجموعة'
      : isEn
      ? 'Scope'
      : 'النطاق',
    dataset.targetTitle,
  ]);
  if (dataset.targetSubtitle) {
    pushRow([isEn ? 'Details' : 'التفاصيل', dataset.targetSubtitle]);
  }
  if (dataset.parentLine) {
    pushRow([isEn ? 'Recipient' : 'ولي الأمر', dataset.parentLine]);
  }
  if (dataset.teacherLine) {
    pushRow([isEn ? 'Teacher' : 'بيانات المعلم', dataset.teacherLine]);
  }
  pushRow([isEn ? 'Period' : 'الفترة الزمنية', dataset.periodLabel]);
  pushRow([isEn ? 'Export Date' : 'تاريخ الإصدار', dataset.exportedAtDate]);
  pushRow([isEn ? 'Total Sessions' : 'إجمالي الحصص', summary.totalSessions]);
  pushRow([isEn ? 'Completed Sessions' : 'الحصص المنفذة', summary.completedSessions]);
  pushRow([isEn ? 'Present' : 'مرات الحضور', summary.presentCount]);
  pushRow([isEn ? 'Late' : 'مرات التأخير', summary.lateCount]);
  pushRow([isEn ? 'Charged Absences' : 'الغياب المحسوب', summary.absentChargedCount]);
  pushRow([isEn ? 'Excused Absences' : 'الغياب المعفى', summary.absentExcusedCount]);
  pushRow([isEn ? 'Attendance Rate' : 'نسبة الالتزام بالحضور', `${summary.commitmentRate}%`]);

  if (dataset.includeFinancials && financials) {
    pushRow([
      isEn ? 'Total Due' : 'إجمالي المستحق',
      `${financials.totalDue} ${financials.currency}`,
    ]);
    pushRow([
      isEn ? 'Total Paid' : 'إجمالي المسدد',
      `${financials.totalPaid} ${financials.currency}`,
    ]);
    pushRow([
      isEn ? 'Remaining Balance' : 'الرصيد المتبقي',
      `${financials.remaining} ${financials.currency}`,
    ]);
  }

  lines.push('');

  pushRow(
    isEn
      ? [
          'Date',
          'Day',
          'Time',
          'Student Name',
          'Group / Subject',
          'Lesson Type',
          'Session Topic',
          'Session Status',
          'Attendance Status',
          'Quantity / Duration',
          'Homework',
          'Behavior',
          'Quiz Score',
          'Notes',
        ]
      : [
          'التاريخ',
          'اليوم',
          'الوقت',
          'اسم الطالب',
          'المجموعة / المادة',
          'نوع الدرس',
          'عنوان الحصة',
          'حالة الحصة',
          'حالة الحضور',
          'الكمية / المدة',
          'الواجب',
          'السلوك',
          'درجة الاختبار',
          'ملاحظات',
        ]
  );

  for (const row of rows) {
    pushRow([
      row.date,
      row.dayLabel,
      row.startTime,
      row.studentName,
      row.serviceName,
      row.lessonTypeLabel,
      row.sessionTitle,
      row.sessionStatusLabel,
      row.attendanceStatusLabel,
      row.quantityLabel,
      row.homeworkLabel,
      row.behaviorLabel,
      row.quizScoreLabel,
      row.notes,
    ]);
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

export function createAttendanceReportCSVBlob(dataset: AttendanceExportDataset): Blob {
  const csvContent = generateAttendanceReportCSV(dataset);
  return new Blob([csvContent], { type: REPORT_MIME_TYPES.csv });
}

export async function generateAttendanceReportPDFBlob(
  dataset: AttendanceExportDataset
): Promise<Blob> {
  const { renderVectorAttendanceReportPDF } = await import('./pdfVectorReport');
  return renderVectorAttendanceReportPDF(dataset);
}

export function detectReportRuntimeEnvironment(
  userAgentOverride?: string
): ReportRuntimeEnvironment {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const isCapacitorNativeAndroid = isNative && platform === 'android';
  const isCapacitorNativeIOS = isNative && platform === 'ios';
  const hasNativeReportSaverPlugin =
    isCapacitorNativeAndroid && Capacitor.isPluginAvailable('ReportFileSaver');

  const ua =
    userAgentOverride !== undefined
      ? userAgentOverride
      : typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : '';
  const isEmbeddedAndroidWebView =
    isCapacitorNativeAndroid || (/Android/i.test(ua) && /;\s*wv\)/i.test(ua));

  return {
    isCapacitorNativeAndroid,
    isCapacitorNativeIOS,
    hasNativeReportSaverPlugin,
    isEmbeddedAndroidWebView,
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  if (!blob || blob.size === 0) {
    throw new ReportSaveError('EMPTY_REPORT_BLOB', 'Generated report file is empty.');
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new ReportSaveError('BASE64_ENCODING_FAILED', 'Failed to encode report file.'));
          return;
        }
        const commaIdx = result.indexOf(',');
        const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
        if (!base64) {
          reject(new ReportSaveError('BASE64_ENCODING_FAILED', 'Encoded report payload is empty.'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => {
        reject(
          new ReportSaveError('BASE64_ENCODING_FAILED', 'Error reading generated report blob.')
        );
      };
      reader.readAsDataURL(blob);
    });
  }

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  throw new ReportSaveError('BASE64_ENCODING_FAILED', 'No base64 encoder available.');
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    throw new ReportSaveError(
      'STORAGE_WRITE_FAILED',
      'Browser file download APIs are unavailable.'
    );
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.className = 'hidden';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Keep Object URL alive long enough for mobile browser confirmation dialogs (e.g. "Download again?")
  const scheduleRevoke = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  scheduleRevoke(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function canNativeShareFile(mimeType: string, ext: 'pdf' | 'csv'): boolean {
  const env = detectReportRuntimeEnvironment();
  if (env.hasNativeReportSaverPlugin) {
    return true;
  }

  try {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function' ||
      typeof navigator.canShare !== 'function' ||
      typeof File === 'undefined'
    ) {
      return false;
    }
    const cleanMime = ext === 'pdf' ? REPORT_MIME_TYPES.pdf : REPORT_MIME_TYPES.csv;
    const probe = new File(['test'], `Classy_Report.${ext}`, {
      type: mimeType || cleanMime,
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

async function tryWebShareFile(
  blob: Blob,
  filename: string,
  mimeType: string,
  title: string,
  text: string
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof File === 'undefined'
  ) {
    return 'unsupported';
  }

  const file = new File([blob], filename, { type: mimeType });
  if (typeof navigator.canShare === 'function') {
    try {
      if (!navigator.canShare({ files: [file] })) {
        return 'unsupported';
      }
    } catch {
      return 'unsupported';
    }
  }

  try {
    await navigator.share({
      title,
      text,
      files: [file],
    });
    return 'shared';
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}

export interface SaveReportBlobParams {
  blob: Blob;
  filename: string;
  format: ReportExportFormat;
  title: string;
  text: string;
  runtimeOverride?: ReportRuntimeEnvironment;
  nativePluginOverride?: ReportFileSaverPlugin;
  browserDownloadOverride?: (blob: Blob, filename: string) => void;
}

export async function saveReportBlob({
  blob,
  filename,
  format,
  title,
  text,
  runtimeOverride,
  nativePluginOverride,
  browserDownloadOverride,
}: SaveReportBlobParams): Promise<ReportSaveResult> {
  if (!blob || blob.size === 0) {
    throw new ReportSaveError('EMPTY_REPORT_BLOB', 'Generated report file is empty.');
  }

  const mimeType = REPORT_MIME_TYPES[format];
  const safeFilename = buildReportFilename(filename, format);
  const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  const env = runtimeOverride ?? detectReportRuntimeEnvironment();
  const plugin = nativePluginOverride ?? ReportFileSaver;

  // 1. Android Capacitor APK with native ReportFileSaver bridge (MediaStore.Downloads + SAF + FileProvider)
  if (env.isCapacitorNativeAndroid && env.hasNativeReportSaverPlugin) {
    const base64Data = await blobToBase64(typedBlob);
    try {
      const nativeRes = await plugin.saveToDownloads({
        filename: safeFilename,
        base64Data,
        mimeType,
        title,
        text,
      });

      if (nativeRes.cancelled) {
        return {
          status: 'cancelled',
          filename: nativeRes.filename || safeFilename,
          mimeType,
          method: 'cancelled',
        };
      }

      if (nativeRes.saved) {
        const isMediaStore = nativeRes.method === 'mediastore_downloads';
        return {
          status: isMediaStore ? 'saved_to_downloads' : 'saved_to_device',
          filename: nativeRes.filename || safeFilename,
          mimeType,
          uri: nativeRes.uri,
          method: isMediaStore ? 'mediastore_downloads' : 'saf_create_document',
        };
      }

      if (nativeRes.shared) {
        return {
          status: 'shared',
          filename: nativeRes.filename || safeFilename,
          mimeType,
          method: 'android_sharesheet',
        };
      }

      throw new ReportSaveError(
        'STORAGE_WRITE_FAILED',
        'Android native file saver did not confirm saved output.'
      );
    } catch (nativeErr: any) {
      // Fallback: open Android native share/save sheet so user can select "Save to device"
      try {
        const fallbackShare = await plugin.shareFile({
          filename: safeFilename,
          base64Data,
          mimeType,
          title,
          text,
        });
        if (fallbackShare.cancelled) {
          return {
            status: 'cancelled',
            filename: fallbackShare.filename || safeFilename,
            mimeType,
            method: 'cancelled',
          };
        }
        if (fallbackShare.shared) {
          return {
            status: 'shared',
            filename: fallbackShare.filename || safeFilename,
            mimeType,
            method: 'android_sharesheet',
          };
        }
      } catch {
        // Re-throw primary storage error below
      }
      if (nativeErr instanceof ReportSaveError) {
        throw nativeErr;
      }
      throw new ReportSaveError(
        'STORAGE_WRITE_FAILED',
        nativeErr?.message || 'Could not save report to Android storage.'
      );
    }
  }

  // 2. Embedded Android WebView (without native bridge) or Native iOS: try Web Share API file save/share sheet
  if (env.isEmbeddedAndroidWebView || env.isCapacitorNativeIOS) {
    const webShareOutcome = await tryWebShareFile(
      typedBlob,
      safeFilename,
      mimeType,
      title,
      text
    );
    if (webShareOutcome === 'shared') {
      return {
        status: 'shared',
        filename: safeFilename,
        mimeType,
        method: 'web_share',
      };
    }
    if (webShareOutcome === 'cancelled') {
      return {
        status: 'cancelled',
        filename: safeFilename,
        mimeType,
        method: 'cancelled',
      };
    }

    // Embedded Android WebView silently drops <a href="blob:..." download="..."> clicks — never fake success!
    if (env.isEmbeddedAndroidWebView) {
      throw new ReportSaveError(
        'WEBVIEW_SAVE_UNSUPPORTED',
        'Android WebView requires the native ReportFileSaver bridge or Web Share support to save files.'
      );
    }
  }

  // 3. Standard Web / Mobile Browsers (Chrome, Samsung Internet, Firefox, Safari, Edge) & PWAs
  const runDownload = browserDownloadOverride ?? triggerBlobDownload;
  runDownload(typedBlob, safeFilename);
  return {
    status: 'browser_downloaded',
    filename: safeFilename,
    mimeType,
    method: 'browser_anchor',
  };
}

export async function shareReportBlobWithParent(
  blob: Blob,
  filename: string,
  title: string,
  text: string,
  format?: ReportExportFormat,
  runtimeOverride?: ReportRuntimeEnvironment,
  nativePluginOverride?: ReportFileSaverPlugin
): Promise<ReportSaveResult> {
  if (!blob || blob.size === 0) {
    throw new ReportSaveError('EMPTY_REPORT_BLOB', 'Generated report file is empty.');
  }

  const resolvedFormat: ReportExportFormat =
    format ?? (filename.toLowerCase().endsWith('.csv') ? 'csv' : 'pdf');
  const mimeType = REPORT_MIME_TYPES[resolvedFormat];
  const safeFilename = buildReportFilename(filename, resolvedFormat);
  const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
  const env = runtimeOverride ?? detectReportRuntimeEnvironment();
  const plugin = nativePluginOverride ?? ReportFileSaver;

  // 1. Native Android Share Sheet via FileProvider
  if (env.isCapacitorNativeAndroid && env.hasNativeReportSaverPlugin) {
    const base64Data = await blobToBase64(typedBlob);
    try {
      const shareRes = await plugin.shareFile({
        filename: safeFilename,
        base64Data,
        mimeType,
        title,
        text,
      });
      if (shareRes.cancelled) {
        return {
          status: 'cancelled',
          filename: shareRes.filename || safeFilename,
          mimeType,
          method: 'cancelled',
        };
      }
      return {
        status: 'shared',
        filename: shareRes.filename || safeFilename,
        mimeType,
        method: 'android_sharesheet',
      };
    } catch (err: any) {
      throw new ReportSaveError(
        'STORAGE_WRITE_FAILED',
        err?.message || 'Failed to open Android share options.'
      );
    }
  }

  // 2. Standard Web Share API Level 2 (Files)
  const webShareOutcome = await tryWebShareFile(
    typedBlob,
    safeFilename,
    mimeType,
    title,
    text
  );
  if (webShareOutcome === 'shared') {
    return {
      status: 'shared',
      filename: safeFilename,
      mimeType,
      method: 'web_share',
    };
  }
  if (webShareOutcome === 'cancelled') {
    return {
      status: 'cancelled',
      filename: safeFilename,
      mimeType,
      method: 'cancelled',
    };
  }

  // 3. Fallback to verified save flow
  return saveReportBlob({
    blob: typedBlob,
    filename: safeFilename,
    format: resolvedFormat,
    title,
    text,
    runtimeOverride: env,
    nativePluginOverride: plugin,
  });
}
