import React, { useState, useMemo } from 'react';
import { Session, Group, Student, Payment, ActiveTab } from '../types';
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
} from '../utils/schedule';

interface SessionsViewProps {
  sessions: Session[];
  groups: Group[];
  students?: Student[];
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

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  groups,
  students = [],
  onOpenAddSession,
  onOpenAttendanceModal,
  onOpenStudentProfile,
  onOpenGroupProfile,
  onDataChanged,
  onNavigateToTab,
  onOpenNotificationsModal,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const { todayStr } = useCurrentLocalDate();

  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Enrollments
  const enrollments = useMemo(() => {
    return db.getEnrollments();
  }, [sessions, groups]);

  // Detailed Agenda for selected date (merging saved sessions and recurring scheduled classes)
  const selectedDateAgenda = useMemo(() => {
    return getDetailedAgendaForDate(
      selectedDateStr,
      sessions,
      groups,
      enrollments,
      students,
      true
    );
  }, [selectedDateStr, sessions, groups, enrollments, students]);

  // Convert agenda items into ScheduledClassItems for the timeline
  const timelineItems: ScheduledClassItem[] = useMemo(() => {
    const items = selectedDateAgenda.items.map((it) => {
      const student = it.studentId ? students.find((s) => s.id === it.studentId) : undefined;
      const group = groups.find((g) => g.id === it.groupId);
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

    if (!searchQuery.trim()) return items;

    const q = searchQuery.toLowerCase().trim();
    return items.filter((it) => {
      return (
        it.groupName?.toLowerCase().includes(q) ||
        it.studentName?.toLowerCase().includes(q) ||
        it.subject?.toLowerCase().includes(q)
      );
    });
  }, [selectedDateAgenda.items, students, groups, searchQuery]);

  // Find exact session matching an agenda item
  const findSessionForScheduleItem = (item: ScheduledClassItem) => {
    const agendaItem = selectedDateAgenda.items.find((a) => a.id === item.id);
    if (agendaItem?.session) return agendaItem.session;

    return sessions.find((s) => {
      if (s.date !== selectedDateStr || s.status === 'cancelled') return false;
      if (s.groupId !== item.groupId) return false;
      if (item.studentId && s.studentId && s.studentId !== item.studentId) return false;
      return true;
    });
  };

  // Start class / attendance for a recurring item that does not have an explicit session record yet
  const handleStartRecurringClass = (item: ScheduledClassItem) => {
    const targetGroup = groups.find((g) => g.id === item.groupId);
    const now = new Date().toISOString();
    const newSession: Session = {
      id: 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      groupId: item.groupId,
      title: item.studentName
        ? (isEn ? `Class: ${item.studentName} (${targetGroup?.name || ''})` : `حصة ${item.studentName} (${targetGroup?.name || ''})`)
        : (isEn ? `Class: ${targetGroup?.name || ''}` : `حصة ${targetGroup?.name || ''}`),
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
  };

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar px-5 py-4 space-y-4 text-ink pb-32 bg-page relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. Screen Header */}
      <ScreenHeader
        title={t('sessionsTitle') || (isEn ? 'Sessions' : 'الحصص')}
        onOpenNotifications={onOpenNotificationsModal}
        onOpenSettings={onNavigateToTab ? () => onNavigateToTab('settings') : undefined}
      />

      {/* 2. NavyCalendar Card */}
      <NavyCalendar
        selectedDateStr={selectedDateStr}
        onSelectDate={(d) => setSelectedDateStr(d)}
        sessions={sessions}
        groups={groups}
        students={students}
        onOpenAddSession={onOpenAddSession}
        viewMode={viewMode}
        onViewModeChange={(vm) => setViewMode(vm)}
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
          selectedDateStr={selectedDateStr}
          isToday={selectedDateStr === todayStr}
          findSessionForScheduleItem={findSessionForScheduleItem}
          onRecordAttendance={handleStartRecurringClass}
          onOpenAttendanceModal={onOpenAttendanceModal}
          onOpenStudentProfile={onOpenStudentProfile}
          onOpenGroupProfile={onOpenGroupProfile}
          onOpenAddSession={onOpenAddSession}
        />
      </div>
    </div>
  );
};

export default SessionsView;
