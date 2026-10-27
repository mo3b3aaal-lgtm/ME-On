import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { Session, Group, Student, Enrollment, Payment, ActiveTab } from '../types';
import { db } from '../utils/storage';
import { ScreenHeader } from './ui/ScreenHeader';
import { NavyCalendar } from './NavyCalendar';
import { SessionTimeline } from './SessionTimeline';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { AppIcon } from './ui/AppIcon';
import {
  getDetailedAgendaForDate,
  ScheduledClassItem,
  parseTimeToMinutes,
} from '../utils/schedule';
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';
import { Attendance } from '../types';

interface SessionsViewProps {
  sessions: Session[];
  groups: Group[];
  students?: Student[];
  enrollments?: Enrollment[];
  allAttendance?: Attendance[];
  payments?: Payment[];
  onOpenAddSession: (defaultGroupId?: string, defaultDate?: string) => void;
  onEditSession: (session: Session) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onOpenStudentProfile?: (student: Student) => void;
  onOpenGroupProfile?: (group: Group) => void;
  onSessionDeleted: () => void;
  onDataChanged?: () => void;
  onNavigateToTab?: (tab: ActiveTab) => void;
  onOpenNotificationsModal?: () => void;
  unreadNotificationsCount?: number;
  isLoading?: boolean;
}

/**
 * Formats date into a localized heading like "Wednesday, 12th March" or "الأربعاء، 12 مارس"
 */
function formatSelectedDateHeading(dateStr: string, isEn: boolean): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isEn) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = d;
    const suffix =
      day === 1 || day === 21 || day === 31
        ? 'st'
        : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
        ? 'rd'
        : 'th';
    return `${weekday}, ${day}${suffix} ${month}`;
  } else {
    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const arabicMonths = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];
    const weekday = arabicDays[date.getDay()];
    const month = arabicMonths[m - 1];
    return `${weekday}، ${d} ${month}`;
  }
}

const EMPTY_STUDENTS: Student[] = [];

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  groups,
  students = EMPTY_STUDENTS,
  enrollments: enrollmentsProp,
  allAttendance: allAttendanceProp,
  onOpenAddSession,
  onOpenAttendanceModal,
  onOpenStudentProfile,
  onOpenGroupProfile,
  onDataChanged,
  onNavigateToTab,
  onOpenNotificationsModal,
  unreadNotificationsCount,
  isLoading = false,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const { todayStr } = useCurrentLocalDate();

  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const studentsById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // Enrollments & Attendance snapshots
  const enrollments = useMemo(() => {
    return enrollmentsProp ?? db.getEnrollments();
  }, [enrollmentsProp, sessions, groups, students]);

  const allAttendance = useMemo(() => {
    return allAttendanceProp ?? db.getAttendance();
  }, [allAttendanceProp, sessions]);

  // Detailed Agenda for selected date (merging saved sessions and recurring scheduled classes)
  const selectedDateAgenda = useMemo(() => {
    return getDetailedAgendaForDate(
      selectedDateStr,
      sessions,
      groups,
      enrollments,
      students,
      true,
      allAttendance
    );
  }, [selectedDateStr, sessions, groups, enrollments, students, allAttendance]);

  // Convert agenda items into ScheduledClassItems for the timeline
  const timelineItems: ScheduledClassItem[] = useMemo(() => {
    const items = selectedDateAgenda.items.map((it) => {
      const student = it.studentId ? studentsById.get(it.studentId) : undefined;
      const group = it.groupId ? groupsById.get(it.groupId) : undefined;
      return {
        id: it.id,
        groupId: it.groupId,
        groupName: it.groupName,
        group,
        studentId: it.studentId,
        studentName: it.studentName,
        student,
        isPrivate: it.isPrivate,
        subject: it.subject,
        dayName: it.dayName,
        time: it.formattedTime || (it.endTime ? `${it.startTime} - ${it.endTime}` : it.startTime),
        rawTime: it.startTime,
        sortMinutes: it.sortMinutes,
        location: it.location,
        accentColor: it.accentColor,
      };
    });

    const q = deferredSearchQuery.toLowerCase().trim();
    if (!q) return items;

    return items.filter((it) => {
      return (
        it.groupName?.toLowerCase().includes(q) ||
        it.studentName?.toLowerCase().includes(q) ||
        it.subject?.toLowerCase().includes(q)
      );
    });
  }, [selectedDateAgenda.items, studentsById, groupsById, deferredSearchQuery]);

  // Find exact session matching an agenda item
  const findSessionForScheduleItem = useCallback(
    (item: ScheduledClassItem) => {
      const agendaItem = selectedDateAgenda.items.find((a) => a.id === item.id);
      if (agendaItem?.session) return agendaItem.session;

      const itemMins = item.sortMinutes || parseTimeToMinutes(item.rawTime || item.time);
      return sessions.find((s) => {
        if (s.date !== selectedDateStr || s.status === 'cancelled') return false;
        if (item.isPrivate || item.studentId) {
          if (s.studentId !== item.studentId) return false;
        } else {
          if (s.groupId !== item.groupId) return false;
        }
        const sMins = parseTimeToMinutes(s.startTime || '16:00');
        return sMins === itemMins;
      });
    },
    [selectedDateAgenda.items, sessions, selectedDateStr]
  );

  // Start class / attendance for a recurring item that does not have an explicit session record yet
  const handleStartRecurringClass = useCallback(
    (item: ScheduledClassItem) => {
      const isPrivate = item.isPrivate || !!item.studentId;
      const targetGroup = item.groupId ? groups.find((g) => g.id === item.groupId) : undefined;
      const itemMins = item.sortMinutes || parseTimeToMinutes(item.rawTime || item.time || '16:00');
      const deterministicEntityKey = isPrivate
        ? `stu_${item.studentId || 'priv'}`
        : `grp_${item.groupId || 'academic'}`;
      const deterministicId = `sess_${selectedDateStr}_${deterministicEntityKey}_${itemMins}`;

      // Check if session already exists
      const existing =
        sessions.find((s) => s.id === deterministicId) ||
        findSessionForScheduleItem(item) ||
        db.getSessionById(deterministicId);
      if (existing) {
        onOpenAttendanceModal(existing);
        return;
      }

      const now = new Date().toISOString();
      const newSession: Session = {
        id: deterministicId,
        groupId: item.groupId || '',
        title: isPrivate
          ? item.studentName
            ? `${isEn ? 'Private Lesson' : 'درس خاص'} - ${item.studentName}`
            : isEn
            ? 'Private Lesson'
            : 'درس خاص'
          : targetGroup?.name || item.groupName || (isEn ? 'Class' : 'حصة'),
        date: selectedDateStr,
        dayName: item.dayName,
        startTime: item.rawTime || item.time?.split(' - ')[0] || '16:00',
        endTime: item.time?.split(' - ')[1] || '',
        sessionNumber: 1,
        hours: 1.5,
        hourlyRate: targetGroup?.hourlyRate || targetGroup?.defaultPrice || 100,
        pricePerStudent: targetGroup?.defaultPrice || 100,
        status: 'scheduled',
        notes: '',
        studentId: item.studentId,
        year: parseInt(selectedDateStr.split('-')[0], 10),
        month: parseInt(selectedDateStr.split('-')[1], 10),
        createdAt: now,
        updatedAt: now,
      };

      db.saveSession(newSession);
      if (onDataChanged) onDataChanged();
      onOpenAttendanceModal(newSession);
    },
    [groups, selectedDateStr, sessions, findSessionForScheduleItem, onOpenAttendanceModal, isEn, onDataChanged]
  );

  const [privateIntakeTarget, setPrivateIntakeTarget] = useState<{
    item?: ScheduledClassItem;
    session?: Session;
    studentId: string;
  } | null>(null);

  // Router for session taps: opens PrivateClassIntakeModal for private lessons, group modal for groups
  const handleSessionCardClick = useCallback(
    (item: ScheduledClassItem, matchingSession?: Session) => {
      const isPrivate =
        item.isPrivate ||
        !!item.studentId ||
        (matchingSession ? !matchingSession.groupId || !!matchingSession.studentId : false);

      const existing = matchingSession || findSessionForScheduleItem(item);

      if (isPrivate) {
        const studentId =
          item.studentId ||
          matchingSession?.studentId ||
          (item.studentName ? students.find((s) => s.name === item.studentName)?.id : '') ||
          '';

        if (studentId) {
          setPrivateIntakeTarget({
            item,
            session: existing,
            studentId,
          });
          return;
        }
      }

      if (existing) {
        onOpenAttendanceModal(existing);
      } else {
        handleStartRecurringClass(item);
      }
    },
    [findSessionForScheduleItem, students, onOpenAttendanceModal, handleStartRecurringClass]
  );

  const handleConfirmPrivateIntake = (result: PrivateClassIntakeResult) => {
    if (!privateIntakeTarget) return;
    const { item, session: targetSession, studentId } = privateIntakeTarget;

    let session = targetSession;
    if (!session && item) {
      const now = new Date().toISOString();
      const itemMins = item.sortMinutes || parseTimeToMinutes(item.rawTime || item.time || '16:00');
      const deterministicId = `sess_${selectedDateStr}_stu_${studentId}_${itemMins}`;
      session = db.getSessionById(deterministicId) || {
        id: deterministicId,
        groupId: '',
        title: item.studentName
          ? (isEn ? `Private Lesson - ${item.studentName}` : `درس خاص - ${item.studentName}`)
          : (isEn ? 'Private Lesson' : 'درس خاص'),
        date: selectedDateStr,
        dayName: item.dayName,
        startTime: item.rawTime || item.time?.split(' - ')[0] || '16:00',
        endTime: item.time?.split(' - ')[1] || '',
        sessionNumber: 1,
        hours: result.hours || 1.5,
        hourlyRate: result.pricePerStudent || 100,
        pricePerStudent: result.pricePerStudent || 100,
        status: 'scheduled',
        studentId,
        year: parseInt(selectedDateStr.split('-')[0], 10),
        month: parseInt(selectedDateStr.split('-')[1], 10),
        createdAt: now,
        updatedAt: now,
      };
    }
    if (!session) return;

    const enr = enrollments.find(
      (e) => e.studentId === studentId && (e.serviceType === 'private' || !e.groupId)
    );
    const isHourly = session.isHourly || enr?.billingMode === 'hourly' || enr?.billingType === 'hourly';
    const finalStatus = result.attendanceStatus || 'present';
    const isCharged = result.isCharged !== undefined ? result.isCharged : (finalStatus !== 'absent_free');
    const existingAtt = db.getSessionAttendance(session.id).find((a) => a.studentId === studentId);

    const record: Attendance = {
      ...existingAtt,
      id: existingAtt?.id || `att_${session.id}_${studentId}`,
      sessionId: session.id,
      studentId,
      enrollmentId: enr?.id || session.enrollmentId,
      status: finalStatus,
      isCharged,
      sessionUnits: isHourly ? undefined : result.sessionUnits,
      hours: isHourly ? result.hours : undefined,
      notes: result.notes,
      behaviorRating: result.behaviorRating,
      homeworkRating: result.homeworkRating,
      absenceReason:
        finalStatus === 'absent_free'
          ? (result.notes || (isEn ? 'Uncharged Absence' : 'غياب غير محسوب'))
          : undefined,
      recordedAt: existingAtt?.recordedAt || new Date().toISOString(),
    };

    db.saveSession({
      ...session,
      status: 'completed',
      sessionUnits: isHourly ? undefined : result.sessionUnits,
      hours: isHourly ? result.hours : undefined,
      pricePerStudent: result.pricePerStudent,
      notes: result.notes !== undefined ? result.notes : session.notes,
    });
    db.saveAttendanceBatch(session.id, [record]);

    setPrivateIntakeTarget(null);
    if (onDataChanged) onDataChanged();
  };

  const privateIntakeStudent = useMemo(() => {
    if (!privateIntakeTarget) return null;
    return students.find((s) => s.id === privateIntakeTarget.studentId) || null;
  }, [privateIntakeTarget, students]);

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar px-5 py-4 space-y-4 text-ink pb-32 bg-page relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. Screen Header */}
      <ScreenHeader
        title={t('sessionsTitle') || (isEn ? 'Sessions' : 'الحصص')}
        unreadCount={unreadNotificationsCount}
        onOpenNotifications={onOpenNotificationsModal}
        onOpenSettings={onNavigateToTab ? () => onNavigateToTab('settings') : undefined}
      />

      {/* 2. NavyCalendar Card */}
      <NavyCalendar
        selectedDateStr={selectedDateStr}
        onSelectDate={setSelectedDateStr}
        sessions={sessions}
        groups={groups}
        students={students}
        enrollments={enrollments}
        onOpenAddSession={onOpenAddSession}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 3. Below the card: Selected date heading (.t-title) + Quick Search Toggle */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="t-title text-navy truncate">
              {formatSelectedDateHeading(selectedDateStr, isEn)}
            </h2>
            {selectedDateStr === todayStr && (
              <span className="px-2.5 py-0.5 rounded-full bg-mint text-navy font-bold text-xs shrink-0 shadow-2xs">
                {isEn ? 'Today' : 'اليوم'}
              </span>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              aria-label={isEn ? 'Search sessions' : 'بحث في الحصص'}
              title={isEn ? 'Search sessions' : 'بحث في الحصص'}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isSearchOpen || searchQuery
                  ? 'bg-navy text-white shadow-xs'
                  : 'bg-page border border-line text-slate hover:text-navy hover:bg-mint-soft'
              }`}
            >
              <AppIcon name="search" size={16} weight="regular" />
            </button>
          </div>
        </div>

        {/* Optional Search Input Dropdown */}
        {isSearchOpen && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? 'Filter sessions by name or subject...' : 'تصفية الحصص بالاسم أو المادة...'}
              className="classy-input w-full py-2 ps-9 pe-9 text-xs rounded-xl"
            />
            <div className="absolute top-2.5 start-3 text-slate pointer-events-none">
              <AppIcon name="search" size={14} weight="regular" />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-2 end-2.5 p-1 text-slate hover:text-navy cursor-pointer"
              >
                <AppIcon name="x" size={14} weight="bold" />
              </button>
            )}
          </div>
        )}

        {/* 4. SessionTimeline */}
        <SessionTimeline
          items={timelineItems}
          sessions={sessions}
          students={students}
          groups={groups}
          allAttendance={allAttendance}
          selectedDateStr={selectedDateStr}
          isToday={selectedDateStr === todayStr}
          isLoading={Boolean(isLoading) && sessions.length === 0 && groups.length === 0 && students.length === 0}
          findSessionForScheduleItem={findSessionForScheduleItem}
          onTapSession={handleSessionCardClick}
          onRecordAttendance={handleStartRecurringClass}
          onOpenAttendanceModal={onOpenAttendanceModal}
          onOpenStudentProfile={onOpenStudentProfile}
          onOpenGroupProfile={onOpenGroupProfile}
          onOpenAddSession={onOpenAddSession}
        />
      </div>

      {/* Private Class Intake Modal */}
      {privateIntakeTarget && (
        <PrivateClassIntakeModal
          isOpen={!!privateIntakeTarget}
          onClose={() => setPrivateIntakeTarget(null)}
          student={privateIntakeStudent}
          session={privateIntakeTarget.session}
          onConfirm={handleConfirmPrivateIntake}
        />
      )}
    </div>
  );
};

export default SessionsView;
