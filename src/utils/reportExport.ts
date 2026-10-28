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

function sanitizeFilenameSegment(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 48);
  return cleaned || 'report';
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
  const suggestedBaseFilename = `Classy_${scope}_${safeSlug}_${todayStr}`;

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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fitTextWithEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}…`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${text.slice(0, Math.max(1, low)).trimEnd()}…`;
}

function getAttendanceStatusHex(status: AttendanceStatus | 'unrecorded'): string {
  switch (status) {
    case 'present':
      return '#2E8B83';
    case 'late':
      return '#D97706';
    case 'absent_charged':
    case 'absent':
      return '#D64545';
    case 'absent_free':
    case 'excused':
      return '#2F4E78';
    default:
      return '#64748B';
  }
}

export async function generateAttendanceReportPDFBlob(
  dataset: AttendanceExportDataset
): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed with fallback system fonts if font readiness rejects
    }
  }

  const { jsPDF } = await import('jspdf');

  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN_X = 56;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const FOOTER_RESERVE = 78;
  const isRTL = !dataset.isEn;
  const fontStack = `'Cairo', 'Poppins', system-ui, -apple-system, sans-serif`;

  const canvases: HTMLCanvasElement[] = [];

  const createBlankPage = (): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  } => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable for PDF generation');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.direction = isRTL ? 'rtl' : 'ltr';
    ctx.textBaseline = 'middle';
    canvases.push(canvas);
    return { canvas, ctx };
  };

  const drawAlignedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    boxX: number,
    boxW: number,
    centerY: number,
    align: 'start' | 'end' | 'center' = 'start',
    padding = 12
  ) => {
    const maxW = Math.max(20, boxW - padding * 2);
    const fitted = fitTextWithEllipsis(ctx, text, maxW);
    if (align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(fitted, boxX + boxW / 2, centerY);
      return;
    }
    const isRight = (isRTL && align === 'start') || (!isRTL && align === 'end');
    ctx.textAlign = isRight ? 'right' : 'left';
    const anchorX = isRight ? boxX + boxW - padding : boxX + padding;
    ctx.fillText(fitted, anchorX, centerY);
  };

  const colDefs = [
    {
      key: 'date',
      ratio: 0.16,
      label: dataset.isEn ? 'Date & Time' : 'التاريخ والوقت',
      align: 'start' as const,
    },
    {
      key: 'subject',
      ratio: 0.21,
      label:
        dataset.scope === 'student'
          ? dataset.isEn
            ? 'Subject / Service'
            : 'المادة / الخدمة'
          : dataset.isEn
          ? 'Student / Service'
          : 'الطالب / الخدمة',
      align: 'start' as const,
    },
    {
      key: 'topic',
      ratio: 0.18,
      label: dataset.isEn ? 'Topic & Qty' : 'الحصة والكمية',
      align: 'start' as const,
    },
    {
      key: 'attendance',
      ratio: 0.14,
      label: dataset.isEn ? 'Attendance' : 'حالة الحضور',
      align: 'start' as const,
    },
    {
      key: 'evaluation',
      ratio: 0.16,
      label: dataset.isEn ? 'HW & Behavior' : 'الواجب والسلوك',
      align: 'start' as const,
    },
    {
      key: 'notes',
      ratio: 0.15,
      label: dataset.isEn ? 'Notes' : 'ملاحظات',
      align: 'start' as const,
    },
  ];

  const getColumnBoxes = () => {
    const boxes: { x: number; w: number; label: string; key: string; align: 'start' | 'end' | 'center' }[] = [];
    let cursor = isRTL ? MARGIN_X + CONTENT_W : MARGIN_X;
    for (const col of colDefs) {
      const w = Math.round(CONTENT_W * col.ratio);
      const x = isRTL ? cursor - w : cursor;
      boxes.push({ x, w, label: col.label, key: col.key, align: col.align });
      cursor = isRTL ? cursor - w : cursor + w;
    }
    return boxes;
  };

  const columnBoxes = getColumnBoxes();

  const drawTableHeader = (ctx: CanvasRenderingContext2D, topY: number): number => {
    const headerH = 46;
    drawRoundedRect(ctx, MARGIN_X, topY, CONTENT_W, headerH, 12);
    ctx.fillStyle = '#17375E';
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 14px ${fontStack}`;
    for (const box of columnBoxes) {
      drawAlignedText(ctx, box.label, box.x, box.w, topY + headerH / 2, box.align, 10);
    }
    return topY + headerH + 6;
  };

  const drawContinuationBanner = (ctx: CanvasRenderingContext2D): number => {
    const topY = 48;
    ctx.fillStyle = '#17375E';
    ctx.font = `700 18px ${fontStack}`;
    drawAlignedText(
      ctx,
      `${dataset.reportTitle} — ${dataset.targetTitle}`,
      MARGIN_X,
      CONTENT_W * 0.68,
      topY + 14,
      'start',
      0
    );

    ctx.fillStyle = '#4A5B6E';
    ctx.font = `600 14px ${fontStack}`;
    drawAlignedText(
      ctx,
      dataset.periodLabel,
      isRTL ? MARGIN_X : MARGIN_X + CONTENT_W * 0.68,
      CONTENT_W * 0.32,
      topY + 14,
      'end',
      0
    );

    ctx.strokeStyle = '#E1EBEC';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, topY + 36);
    ctx.lineTo(MARGIN_X + CONTENT_W, topY + 36);
    ctx.stroke();

    return drawTableHeader(ctx, topY + 52);
  };

  // --- PAGE 1 ---
  let { ctx } = createBlankPage();
  let cursorY = 52;

  // 1. Hero Header Card
  const heroH = dataset.parentLine || dataset.teacherLine ? 190 : 166;
  drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, heroH, 24);
  ctx.fillStyle = '#17375E';
  ctx.fill();

  // Accent bar inside hero
  const accentW = 8;
  const accentX = isRTL ? MARGIN_X + CONTENT_W - 26 : MARGIN_X + 18;
  drawRoundedRect(ctx, accentX, cursorY + 26, accentW, heroH - 52, 4);
  ctx.fillStyle = '#F5A04A';
  ctx.fill();

  const heroMainW = CONTENT_W * 0.64;
  const heroMainX = isRTL ? MARGIN_X + CONTENT_W - heroMainW - 38 : MARGIN_X + 38;
  const heroSideW = CONTENT_W - heroMainW - 56;
  const heroSideX = isRTL ? MARGIN_X + 20 : MARGIN_X + CONTENT_W - heroSideW - 20;

  ctx.fillStyle = '#B9DAD6';
  ctx.font = `600 15px ${fontStack}`;
  drawAlignedText(ctx, dataset.reportTitle, heroMainX, heroMainW, cursorY + 38, 'start', 4);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 28px ${fontStack}`;
  drawAlignedText(ctx, dataset.targetTitle, heroMainX, heroMainW, cursorY + 78, 'start', 4);

  if (dataset.targetSubtitle) {
    ctx.fillStyle = '#DCEDEB';
    ctx.font = `500 15px ${fontStack}`;
    drawAlignedText(ctx, dataset.targetSubtitle, heroMainX, heroMainW, cursorY + 116, 'start', 4);
  }

  const bottomMetaLine = dataset.parentLine || dataset.teacherLine;
  if (bottomMetaLine) {
    ctx.fillStyle = '#F5A04A';
    ctx.font = `600 14px ${fontStack}`;
    drawAlignedText(ctx, bottomMetaLine, heroMainX, heroMainW, cursorY + 152, 'start', 4);
  }

  // Hero Side Meta Box (Period + Date + Teacher)
  drawRoundedRect(ctx, heroSideX, cursorY + 24, heroSideW, heroH - 48, 16);
  ctx.fillStyle = '#0F2A4A';
  ctx.fill();

  ctx.fillStyle = '#B9DAD6';
  ctx.font = `600 13px ${fontStack}`;
  drawAlignedText(
    ctx,
    dataset.isEn ? 'Reporting Period' : 'الفترة الزمنية',
    heroSideX,
    heroSideW,
    cursorY + 52,
    'start',
    16
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 16px ${fontStack}`;
  drawAlignedText(ctx, dataset.periodLabel, heroSideX, heroSideW, cursorY + 80, 'start', 16);

  ctx.fillStyle = '#8493A3';
  ctx.font = `500 13px ${fontStack}`;
  drawAlignedText(
    ctx,
    dataset.isEn
      ? `Issued: ${dataset.exportedAtDate}`
      : `تاريخ الإصدار: ${dataset.exportedAtDate}`,
    heroSideX,
    heroSideW,
    cursorY + 112,
    'start',
    16
  );

  if (dataset.teacherLine && dataset.parentLine) {
    ctx.fillStyle = '#DCEDEB';
    ctx.font = `500 12px ${fontStack}`;
    drawAlignedText(ctx, dataset.teacherLine, heroSideX, heroSideW, cursorY + 142, 'start', 16);
  }

  cursorY += heroH + 22;

  // 2. Summary KPI Grid (4 Tiles)
  const tileGap = 16;
  const tileW = (CONTENT_W - tileGap * 3) / 4;
  const tileH = 104;
  const { summary } = dataset;

  const kpiTiles = [
    {
      label: dataset.isEn ? 'Attendance Rate' : 'نسبة الالتزام بالحضور',
      value: `${summary.commitmentRate}%`,
      sub: dataset.isEn
        ? `${summary.presentCount + summary.lateCount} attended`
        : `${summary.presentCount + summary.lateCount} حضور فعلي`,
      accent:
        summary.commitmentRate >= 80
          ? '#2E8B83'
          : summary.commitmentRate >= 60
          ? '#D97706'
          : '#D64545',
    },
    {
      label: dataset.isEn ? 'Completed Lessons' : 'الحصص المنفذة',
      value: String(summary.completedSessions),
      sub: dataset.isEn
        ? `of ${summary.totalSessions} total sessions`
        : `من إجمالي ${summary.totalSessions} حصة`,
      accent: '#17375E',
    },
    {
      label: dataset.isEn ? 'Present & Late' : 'الحضور والتأخير',
      value: `${summary.presentCount}`,
      sub: dataset.isEn ? `${summary.lateCount} late` : `${summary.lateCount} مرات تأخير`,
      accent: '#2E8B83',
    },
    {
      label: dataset.isEn ? 'Absences' : 'الغياب المسجل',
      value: `${roundMoney(summary.absentChargedCount + summary.absentExcusedCount, 2)}`,
      sub: dataset.isEn
        ? `${summary.absentChargedCount} charged · ${summary.absentExcusedCount} excused`
        : `${summary.absentChargedCount} محسوب · ${summary.absentExcusedCount} معفى`,
      accent: summary.absentChargedCount > 0 ? '#D64545' : '#4A5B6E',
    },
  ];

  kpiTiles.forEach((tile, idx) => {
    const visualIndex = isRTL ? 3 - idx : idx;
    const tx = MARGIN_X + visualIndex * (tileW + tileGap);
    drawRoundedRect(ctx, tx, cursorY, tileW, tileH, 16);
    ctx.fillStyle = '#F1F7F7';
    ctx.fill();
    ctx.strokeStyle = '#E1EBEC';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#4A5B6E';
    ctx.font = `600 13px ${fontStack}`;
    drawAlignedText(ctx, tile.label, tx, tileW, cursorY + 24, 'start', 14);

    ctx.fillStyle = tile.accent;
    ctx.font = `700 26px ${fontStack}`;
    drawAlignedText(ctx, tile.value, tx, tileW, cursorY + 56, 'start', 14);

    ctx.fillStyle = '#64748B';
    ctx.font = `500 12px ${fontStack}`;
    drawAlignedText(ctx, tile.sub, tx, tileW, cursorY + 84, 'start', 14);
  });

  cursorY += tileH + 18;

  // 3. Optional Financial Strip
  if (dataset.includeFinancials && dataset.financials) {
    const fin = dataset.financials;
    const finH = 62;
    drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, finH, 14);
    ctx.fillStyle = '#DCEDEB';
    ctx.fill();
    ctx.strokeStyle = '#B9DAD6';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const thirdW = CONTENT_W / 3;
    const finItems = [
      {
        label: dataset.isEn ? 'Total Required' : 'إجمالي المستحق',
        val: `${fin.totalDue} ${fin.currency}`,
        color: '#17375E',
      },
      {
        label: dataset.isEn ? 'Total Paid' : 'إجمالي المسدد',
        val: `${fin.totalPaid} ${fin.currency}`,
        color: '#2E8B83',
      },
      {
        label: dataset.isEn ? 'Remaining Balance' : 'الرصيد المتبقي',
        val: `${fin.remaining} ${fin.currency}`,
        color: fin.remaining > 0 ? '#D64545' : '#2E8B83',
      },
    ];

    finItems.forEach((item, idx) => {
      const vIdx = isRTL ? 2 - idx : idx;
      const fx = MARGIN_X + vIdx * thirdW;
      ctx.fillStyle = '#4A5B6E';
      ctx.font = `600 13px ${fontStack}`;
      drawAlignedText(ctx, `${item.label}:`, fx, thirdW * 0.55, cursorY + finH / 2, 'start', 16);

      ctx.fillStyle = item.color;
      ctx.font = `700 16px ${fontStack}`;
      drawAlignedText(
        ctx,
        item.val,
        isRTL ? fx : fx + thirdW * 0.45,
        thirdW * 0.55,
        cursorY + finH / 2,
        'end',
        16
      );
    });

    cursorY += finH + 20;
  }

  // 4. Table Header & Session Rows
  cursorY = drawTableHeader(ctx, cursorY);

  if (dataset.rows.length === 0) {
    const emptyH = 140;
    drawRoundedRect(ctx, MARGIN_X, cursorY + 12, CONTENT_W, emptyH, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#E1EBEC';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#4A5B6E';
    ctx.font = `600 16px ${fontStack}`;
    drawAlignedText(
      ctx,
      dataset.isEn
        ? 'No sessions or attendance records found for the selected period.'
        : 'لا توجد حصص أو سجلات حضور مسجلة خلال الفترة المحددة.',
      MARGIN_X,
      CONTENT_W,
      cursorY + 12 + emptyH / 2,
      'center',
      24
    );
  } else {
    const rowH = 62;
    for (let i = 0; i < dataset.rows.length; i++) {
      const row = dataset.rows[i];
      if (cursorY + rowH > PAGE_H - FOOTER_RESERVE) {
        const nextPage = createBlankPage();
        ctx = nextPage.ctx;
        cursorY = drawContinuationBanner(ctx);
      }

      if (i % 2 === 1) {
        ctx.fillStyle = '#F8FBFB';
        ctx.fillRect(MARGIN_X, cursorY, CONTENT_W, rowH);
      }

      ctx.strokeStyle = '#E1EBEC';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, cursorY + rowH);
      ctx.lineTo(MARGIN_X + CONTENT_W, cursorY + rowH);
      ctx.stroke();

      const topLineY = cursorY + 21;
      const subLineY = cursorY + 43;

      for (const box of columnBoxes) {
        if (box.key === 'date') {
          ctx.fillStyle = '#17375E';
          ctx.font = `700 13px ${fontStack}`;
          drawAlignedText(ctx, row.date, box.x, box.w, topLineY, box.align, 10);
          ctx.fillStyle = '#64748B';
          ctx.font = `500 12px ${fontStack}`;
          drawAlignedText(
            ctx,
            `${row.dayLabel} · ${row.startTime}`,
            box.x,
            box.w,
            subLineY,
            box.align,
            10
          );
        } else if (box.key === 'subject') {
          const primaryLabel =
            dataset.scope === 'student' ? row.serviceName : row.studentName;
          const secondaryLabel =
            dataset.scope === 'student'
              ? row.lessonTypeLabel
              : `${row.serviceName} · ${row.lessonTypeLabel}`;
          ctx.fillStyle = '#17375E';
          ctx.font = `700 13px ${fontStack}`;
          drawAlignedText(ctx, primaryLabel, box.x, box.w, topLineY, box.align, 10);
          ctx.fillStyle = '#64748B';
          ctx.font = `500 12px ${fontStack}`;
          drawAlignedText(ctx, secondaryLabel, box.x, box.w, subLineY, box.align, 10);
        } else if (box.key === 'topic') {
          ctx.fillStyle = '#17375E';
          ctx.font = `600 13px ${fontStack}`;
          drawAlignedText(ctx, row.sessionTitle, box.x, box.w, topLineY, box.align, 10);
          ctx.fillStyle = '#4A5B6E';
          ctx.font = `500 12px ${fontStack}`;
          drawAlignedText(
            ctx,
            `${row.quantityLabel} · ${row.sessionStatusLabel}`,
            box.x,
            box.w,
            subLineY,
            box.align,
            10
          );
        } else if (box.key === 'attendance') {
          ctx.fillStyle = getAttendanceStatusHex(row.attendanceStatus);
          ctx.font = `700 13px ${fontStack}`;
          drawAlignedText(
            ctx,
            row.attendanceStatusLabel,
            box.x,
            box.w,
            cursorY + rowH / 2,
            box.align,
            10
          );
        } else if (box.key === 'evaluation') {
          const hwPrefix = dataset.isEn ? 'HW:' : 'واجب:';
          const behPrefix = dataset.isEn ? 'Beh:' : 'سلوك:';
          ctx.fillStyle = '#17375E';
          ctx.font = `600 12px ${fontStack}`;
          drawAlignedText(
            ctx,
            `${hwPrefix} ${row.homeworkLabel}`,
            box.x,
            box.w,
            topLineY,
            box.align,
            10
          );
          ctx.fillStyle = '#4A5B6E';
          ctx.font = `500 12px ${fontStack}`;
          const behText =
            row.quizScoreLabel !== '—'
              ? `${behPrefix} ${row.behaviorLabel} · ${row.quizScoreLabel}`
              : `${behPrefix} ${row.behaviorLabel}`;
          drawAlignedText(ctx, behText, box.x, box.w, subLineY, box.align, 10);
        } else if (box.key === 'notes') {
          ctx.fillStyle = '#4A5B6E';
          ctx.font = `500 12px ${fontStack}`;
          drawAlignedText(
            ctx,
            row.notes || '—',
            box.x,
            box.w,
            cursorY + rowH / 2,
            box.align,
            10
          );
        }
      }

      cursorY += rowH;
    }
  }

  // 5. Stamp Footers on All Pages & Assemble Multi-Page A4 PDF
  const totalPages = canvases.length;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  canvases.forEach((pageCanvas, index) => {
    const pCtx = pageCanvas.getContext('2d');
    if (pCtx) {
      const footerLineY = PAGE_H - 56;
      pCtx.strokeStyle = '#E1EBEC';
      pCtx.lineWidth = 1;
      pCtx.beginPath();
      pCtx.moveTo(MARGIN_X, footerLineY);
      pCtx.lineTo(MARGIN_X + CONTENT_W, footerLineY);
      pCtx.stroke();

      pCtx.fillStyle = '#8493A3';
      pCtx.font = `500 12px ${fontStack}`;
      drawAlignedText(
        pCtx,
        dataset.isEn
          ? 'Classy — Official Session & Attendance Statement'
          : 'Classy — بيان رسمي لمتابعة الحصص والحضور',
        MARGIN_X,
        CONTENT_W * 0.65,
        PAGE_H - 30,
        'start',
        0
      );

      drawAlignedText(
        pCtx,
        dataset.isEn
          ? `Page ${index + 1} of ${totalPages}`
          : `صفحة ${index + 1} من ${totalPages}`,
        isRTL ? MARGIN_X : MARGIN_X + CONTENT_W * 0.65,
        CONTENT_W * 0.35,
        PAGE_H - 30,
        'end',
        0
      );
    }

    if (index > 0) {
      pdf.addPage('a4', 'portrait');
    }
    const imgData = pageCanvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  return pdf.output('blob');
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.className = 'hidden';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

export function canNativeShareFile(mimeType: string, ext: 'pdf' | 'csv'): boolean {
  try {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function' ||
      typeof navigator.canShare !== 'function' ||
      typeof File === 'undefined'
    ) {
      return false;
    }
    const probe = new File(['test'], `report.${ext}`, { type: mimeType });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareReportBlobWithParent(
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
    return false;
  }
  await navigator.share({
    title,
    text,
    files: [file],
  });
  return true;
}
