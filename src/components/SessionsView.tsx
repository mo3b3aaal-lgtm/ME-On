import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  CalendarDays,
  List,
  Sparkles,
  CalendarCheck2,
  BookOpen,
  X,
  Zap,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCheck,
  Bell,
  Settings,
} from 'lucide-react';
import { Session, Group, Student, Attendance, Payment, ActiveTab } from '../types';
import { db } from '../utils/storage';
import { MultiYearCalendar } from './MultiYearCalendar';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { ClassyOwlMascot } from './ClassyOwlMascot';
import {
  getArabicDayForDate,
  parseTimeToMinutes,
  formatTimeDisplay,
  getLocalizedWeekdayName,
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

/** Helper to format actual duration */
function formatDurationLabel(hours?: number, startTime?: string, endTime?: string, isEn = false): string {
  let h = hours;
  if (!h && startTime && endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (!isNaN(sh) && !isNaN(eh)) {
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) h = diff / 60;
    }
  }
  if (!h || h <= 0) return isEn ? '1 hour' : '1 ساعة';
  if (h === 1) return isEn ? '1 hour' : 'ساعة واحدة';
  if (h === 1.5) return isEn ? '1.5 hours' : 'ساعة ونصف';
  if (h === 2) return isEn ? '2 hours' : 'ساعتان';
  if (h === 2.5) return isEn ? '2.5 hours' : 'ساعتان ونصف';
  if (h === 3) return isEn ? '3 hours' : '3 ساعات';

  const totalMins = Math.round(h * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return isEn ? `${mins} mins` : `${mins} دقيقة`;
  if (mins === 0) return isEn ? `${hrs} hrs` : `${hrs} ساعات`;
  return isEn ? `${hrs}h ${mins}m` : `${hrs} س و ${mins} د`;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  groups,
  students = [],
  payments = [],
  onOpenAddSession,
  onEditSession,
  onOpenAttendanceModal,
  onOpenStudentProfile,
  onOpenGroupProfile,
  onSessionDeleted,
  onDataChanged,
  onNavigateToTab,
  onOpenNotificationsModal,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const { todayStr, canonicalWeekday } = useCurrentLocalDate();
  const todayArabicDay = useMemo(() => getArabicDayForDate(todayStr), [todayStr]);
  const todayLocalizedDay = useMemo(() => getLocalizedWeekdayName(canonicalWeekday, isRTL), [canonicalWeekday, isRTL]);

  const [activeSubTab, setActiveSubTab] = useState<'today' | 'calendar' | 'list'>('today');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timeRangeFilter, setTimeRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Quick feedback toast
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setQuickFeedback(msg);
    setTimeout(() => setQuickFeedback(null), 3000);
  };

  // Pre-fetch all attendance
  const allAttendance = useMemo(() => {
    return db.getAttendance();
  }, [sessions]);

  // Today's sessions sorted chronologically
  const todaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.date === todayStr && s.status !== 'cancelled')
      .sort((a, b) => {
        const minA = parseTimeToMinutes(a.startTime);
        const minB = parseTimeToMinutes(b.startTime);
        return minA - minB;
      });
  }, [sessions, todayStr]);

  // Overall session metrics
  const { completedCount, scheduledCount, overallAttendanceRate } = useMemo(() => {
    const comp = sessions.filter((s) => s.status === 'completed').length;
    const sched = sessions.filter((s) => s.status === 'scheduled').length;

    let totalAtt = 0;
    let presentAtt = 0;
    allAttendance.forEach((a) => {
      totalAtt++;
      if (a.status === 'present' || a.status === 'late') {
        presentAtt++;
      }
    });

    const rate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

    return {
      completedCount: comp,
      scheduledCount: sched,
      overallAttendanceRate: rate,
    };
  }, [sessions, allAttendance]);

  // Helper to mark all students present for a session directly
  const handleQuickMarkAllPresent = (session: Session) => {
    const group = groups.find((g) => g.id === session.groupId);
    const isPrivate = group?.type === 'private' || !!session.studentId;
    const groupStudents = isPrivate
      ? (session.studentId ? [db.getStudentById(session.studentId)].filter(Boolean) as Student[] : db.getGroupStudents(session.groupId))
      : db.getGroupStudents(session.groupId);

    const enrollments = db.getEnrollments();
    const records: Attendance[] = groupStudents.map((st) => {
      const enr = enrollments.find(
        (e) => e.studentId === st.id && (e.groupId === session.groupId || e.id === session.enrollmentId)
      );
      return {
        id: `att_${session.id}_${st.id}`,
        sessionId: session.id,
        studentId: st.id,
        enrollmentId: enr?.id || session.enrollmentId,
        status: 'present',
        isCharged: true,
        recordedAt: new Date().toISOString(),
      };
    });

    db.saveAttendanceBatch(session.id, records);
    if (session.status !== 'completed') {
      db.saveSession({ ...session, status: 'completed' });
    }
    showToast(isEn ? `Marked all present for "${session.title}"` : `تم رصد حضور جميع طلاب حصة "${session.title}" بنجاح`);
    if (onDataChanged) onDataChanged();
  };

  const handleDelete = (session: Session) => {
    const sessionAtt = allAttendance.filter((a) => a.sessionId === session.id);
    const hasRecordedAttendance = sessionAtt.length > 0;
    const warningMsg = hasRecordedAttendance
      ? (isEn
          ? `Warning: Session "${session.title}" has attendance recorded for (${sessionAtt.length}) students.\n\nDeleting will clear attendance and adjust balances.\n\nAre you sure?`
          : `تحذير: الحصة "${session.title}" مسجل لها كشف حضور (${sessionAtt.length}) طالب.\n\nحذف الحصة سيؤدي إلى مسح كشف الحضور وتحديث الأرصدة.\n\nهل أنت متأكد من الحذف؟`)
      : (isEn ? `Are you sure you want to permanently delete session "${session.title}"?` : `هل أنت متأكد من حذف حصة "${session.title}" نهائياً؟`);

    if (confirm(warningMsg)) {
      db.deleteSession(session.id);
      onSessionDeleted();
      if (onDataChanged) onDataChanged();
      showToast(isEn ? 'Session deleted successfully' : 'تم حذف الحصة بنجاح');
    }
  };

  // Filtered sessions for list view
  const filteredSessions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return sessions.filter((session) => {
      if (selectedGroupFilter !== 'all' && session.groupId !== selectedGroupFilter) return false;
      if (statusFilter !== 'all' && session.status !== statusFilter) return false;
      if (selectedDate && session.date !== selectedDate) return false;

      // Time Range Quick Filter
      if (timeRangeFilter === 'today' && session.date !== todayStr) return false;
      if (timeRangeFilter === 'month') {
        if (session.month !== currentMonth || session.year !== currentYear) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const group = groups.find((g) => g.id === session.groupId);
        const privateStudent = session.studentId ? db.getStudentById(session.studentId) : undefined;
        const titleMatches = session.title?.toLowerCase().includes(q);
        const groupMatches = group?.name?.toLowerCase().includes(q);
        const studentMatches = privateStudent?.name?.toLowerCase().includes(q);
        const notesMatches = session.notes?.toLowerCase().includes(q);
        if (!titleMatches && !groupMatches && !studentMatches && !notesMatches) return false;
      }
      return true;
    });
  }, [
    sessions,
    groups,
    selectedGroupFilter,
    statusFilter,
    selectedDate,
    timeRangeFilter,
    searchQuery,
    todayStr,
  ]);

  const hasActiveListFilters =
    searchQuery !== '' ||
    selectedGroupFilter !== 'all' ||
    statusFilter !== 'all' ||
    selectedDate !== '' ||
    timeRangeFilter !== 'all';

  const handleResetListFilters = () => {
    setSearchQuery('');
    setSelectedGroupFilter('all');
    setStatusFilter('all');
    setSelectedDate('');
    setTimeRangeFilter('all');
  };

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#0F1206] pb-32 bg-[#F2E9DE] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient background glows matching Classy visual identity */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#293828]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#293828]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#0F1206]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <h1 className="text-2xl font-bold font-display text-[#0F1206] tracking-tight">
          {t('sessionsTitle') || (isEn ? 'Sessions' : 'الحصص')}
        </h1>
        <div className="flex items-center gap-2">
          {onOpenNotificationsModal && (
            <button
              type="button"
              onClick={onOpenNotificationsModal}
              className="relative w-10 h-10 rounded-full bg-[#F8F2EC] border border-[#DDD3C7] flex items-center justify-center text-[#0F1206] hover:bg-[#EDE3D9] transition-colors cursor-pointer shadow-xs"
              title={t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')}
              aria-label={t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')}
            >
              <Bell className="w-5 h-5 text-[#756046]" strokeWidth={1.7} />
            </button>
          )}
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('settings')}
              className="w-10 h-10 rounded-full bg-[#F8F2EC] border border-[#DDD3C7] flex items-center justify-center text-[#0F1206] hover:bg-[#EDE3D9] transition-colors cursor-pointer shadow-xs"
              title={t('navSettings') || (isEn ? 'Settings' : 'الإعدادات')}
              aria-label={t('navSettings') || (isEn ? 'Settings' : 'الإعدادات')}
            >
              <Settings className="w-5 h-5 text-[#756046]" strokeWidth={1.7} />
            </button>
          )}
        </div>
      </header>

      {/* =========================================================================
          1. SESSIONS HERO HEADER
          ========================================================================= */}
      <div className="rounded-[24px] bg-gradient-to-r from-[#293828] via-[#0F1206] to-[#756046] p-5 sm:p-6 text-[#F8F2EC] relative overflow-hidden shadow-xl border border-[#DDD3C7]/15">
        {/* Soft internal gradient orbs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#293828]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#0F1206]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#293828] via-[#0F1206] to-[#293828] p-0.5 shadow-lg shadow-[#293828]/35 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#293828] flex items-center justify-center text-[#F8F2EC]">
                <CalendarCheck2 className="w-6 h-6 text-[#F8F2EC]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#DDD3C7]/90 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#DDD3C7]" />
                  <span>{isEn ? 'Session Scheduling & Tracking' : 'إدارة وجدولة الحصص'}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#F8F2EC] tracking-tight flex items-center gap-2.5 truncate">
                <span>{t('sessionsTitle')}</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/25 shadow-xs">
                  {todaySessions.length} {t('today')}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#DDD3C7]/85 font-medium truncate">
                {isEn ? 'Organize sessions, track attendance and billing all in one place.' : 'رتّب حصصك وتابع الحضور والتحصيل من مكان واحد.'}
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DDD3C7]/20 justify-end">
            <button
              type="button"
              onClick={() => onOpenAddSession()}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#0F1206]/40 transition-all active:scale-95 cursor-pointer hover:brightness-105"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ {t('scheduleSessionBtn')}</span>
            </button>
          </div>
        </div>

        {/* Real Statistics Grid */}
        <div className="grid grid-cols-4 gap-2 pt-4 mt-4 border-t border-[#DDD3C7]/20 text-center">
          <div className="bg-[#F8F2EC]/10 backdrop-blur-md rounded-xl p-2 border border-[#DDD3C7]/15">
            <span className="text-[10px] text-[#DDD3C7]/80 block font-bold">{t('today')}</span>
            <span className="text-base sm:text-lg font-black text-[#F8F2EC]">{todaySessions.length}</span>
          </div>
          <div className="bg-[#F8F2EC]/10 backdrop-blur-md rounded-xl p-2 border border-[#DDD3C7]/15">
            <span className="text-[10px] text-[#DDD3C7]/80 block font-bold">{t('completedSessions')}</span>
            <span className="text-base sm:text-lg font-black text-[#DDD3C7]">{completedCount}</span>
          </div>
          <div className="bg-[#F8F2EC]/10 backdrop-blur-md rounded-xl p-2 border border-[#DDD3C7]/15">
            <span className="text-[10px] text-[#DDD3C7]/80 block font-bold">{t('upcomingSessions')}</span>
            <span className="text-base sm:text-lg font-black text-[#F8F2EC]">{scheduledCount}</span>
          </div>
          <div className="bg-[#F8F2EC]/10 backdrop-blur-md rounded-xl p-2 border border-[#DDD3C7]/15">
            <span className="text-[10px] text-[#DDD3C7]/80 block font-bold">{isEn ? 'Attendance %' : 'نسبة الحضور'}</span>
            <span className="text-base sm:text-lg font-black text-[#F8F2EC]">{overallAttendanceRate}%</span>
          </div>
        </div>
      </div>

      {/* Quick Feedback Toast */}
      {quickFeedback && (
        <div className="p-3.5 rounded-2xl bg-[#0F1206] text-[#F8F2EC] text-xs font-bold flex items-center justify-between shadow-lg shadow-[#0F1206]/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{quickFeedback}</span>
          </div>
          <button onClick={() => setQuickFeedback(null)}>
            <X className="w-4 h-4 text-[#DDD3C7] hover:text-[#F8F2EC]" />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. View Mode Navigation Tabs (Segmented Bar)
          ========================================================================= */}
      <div className="classy-card p-1.5 flex items-center gap-1.5 bg-[#F8F2EC]">
        <button
          type="button"
          onClick={() => setActiveSubTab('today')}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'today'
              ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-md shadow-[#0F1206]/20'
              : 'text-[#756046] hover:text-[#0F1206] hover:bg-[#DDD3C7]/25'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{isEn ? "Today's Schedule" : 'حصص اليوم والجدول'}</span>
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
              activeSubTab === 'today'
                ? 'bg-[#F8F2EC]/20 text-[#F8F2EC]'
                : 'bg-[#DDD3C7]/25 text-[#293828]'
            }`}
          >
            {todaySessions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('calendar')}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'calendar'
              ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-md shadow-[#0F1206]/20'
              : 'text-[#756046] hover:text-[#0F1206] hover:bg-[#DDD3C7]/25'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>{isEn ? 'Calendar & Agenda' : 'التقويم والأجندة'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('list')}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'list'
              ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-md shadow-[#0F1206]/20'
              : 'text-[#756046] hover:text-[#0F1206] hover:bg-[#DDD3C7]/25'
          }`}
        >
          <List className="w-4 h-4" />
          <span>{isEn ? 'Sessions Log' : 'سجل الحصص'}</span>
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
              activeSubTab === 'list'
                ? 'bg-[#F8F2EC]/20 text-[#F8F2EC]'
                : 'bg-[#DDD3C7]/15 text-[#756046] border border-[#DDD3C7]'
            }`}
          >
            {sessions.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
          3. TODAY'S COMMAND CENTER & TIMELINE VIEW
          ========================================================================= */}
      {activeSubTab === 'today' && (
        <div className="space-y-3.5">
          {/* Today Timeline Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DDD3C7]/650 animate-pulse" />
              <h2 className="text-sm sm:text-base font-black text-[#0F1206]">
                {isEn ? `Today's Schedule — ${todayLocalizedDay} (${todayStr})` : `جدول حصص اليوم — ${todayArabicDay} (${todayStr})`}
              </h2>
            </div>
            <span className="text-xs font-bold text-[#756046]">
              {todaySessions.length} {isEn ? 'scheduled' : 'حصص مجدولة'}
            </span>
          </div>

          {todaySessions.length === 0 ? (
            /* Friendly Empty State with Classy Owl Mascot */
            <div className="classy-card p-8 sm:p-12 text-center space-y-4 flex flex-col items-center justify-center relative overflow-hidden bg-[#F8F2EC]">
              <div className="w-28 h-28 flex items-center justify-center">
                <ClassyOwlMascot size="lg" glow={true} pose="happy" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="font-black text-base sm:text-lg text-[#0F1206]">
                  {isEn ? 'No sessions today' : 'مفيش حصص النهارده'}
                </h3>
                <p className="text-xs sm:text-sm text-[#756046] font-medium leading-relaxed">
                  {isEn ? 'A calm day 😌 You can organize your schedule or add a new session.' : 'يوم هادي 😌 تقدر تستغل الوقت في ترتيب جدولك أو إضافة حصة جديدة.'}
                </p>
              </div>
              <button
                onClick={() => onOpenAddSession(undefined, todayStr)}
                className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg shadow-[#0F1206]/30 transition-all cursor-pointer active:scale-95 hover:brightness-105"
              >
                <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                <span>+ {isEn ? 'Schedule Session for Today' : 'جدولة حصة لليوم'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySessions.map((session) => {
                const group = groups.find((g) => g.id === session.groupId);
                const isPrivate = group?.type === 'private' || !!session.studentId;

                const privateStudent = isPrivate
                  ? (session.studentId ? db.getStudentById(session.studentId) : undefined)
                  : undefined;

                const groupStudents = isPrivate
                  ? (privateStudent ? [privateStudent] : db.getGroupStudents(session.groupId))
                  : db.getGroupStudents(session.groupId);

                const attendance = allAttendance.filter((a) => a.sessionId === session.id);
                const isAttendanceRecorded = attendance.length > 0;
                const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
                const absentCount = attendance.filter((a) => a.status !== 'present' && a.status !== 'late').length;

                const isHourly = group?.billingMode === 'hourly' || group?.billingType === 'hourly';
                const durationLabel = formatDurationLabel(session.hours, session.startTime, session.endTime, isEn);

                const themeColor = isPrivate ? '#0F1206' : (group?.accentColor || '#293828');

                return (
                  <div
                    key={session.id}
                    className={`classy-card classy-card-hover p-4 sm:p-5 transition-all space-y-3.5 relative overflow-hidden bg-[#F8F2EC] border ${
                      session.status === 'completed'
                        ? 'border-[#293828]/50 ring-1 ring-[#293828]/30'
                        : 'border-[#DDD3C7]'
                    }`}
                  >
                    {/* Top Accent Line */}
                    <div
                      className="absolute top-0 inset-x-0 h-1.5"
                      style={{ backgroundColor: themeColor }}
                    />

                    {/* Header Row: Time Slot + Title + Badges */}
                    <div className="flex items-start justify-between gap-3 pt-1">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Time Slot Badge Box */}
                        <div className="bg-[#293828] text-[#F8F2EC] p-2.5 rounded-2xl text-center shrink-0 min-w-[72px] shadow-sm">
                          <span className="font-mono text-xs font-black block">
                            {formatTimeDisplay(session.startTime, isRTL)}
                          </span>
                          {session.endTime && (
                            <span className="font-mono text-[10px] text-[#DDD3C7]/80 block border-t border-[#DDD3C7]/20 pt-0.5 mt-0.5">
                              {formatTimeDisplay(session.endTime, isRTL)}
                            </span>
                          )}
                        </div>

                        {/* Title & Identity */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-sm sm:text-base text-[#0F1206] truncate">
                              {isPrivate
                                ? (privateStudent ? `${isEn ? 'Private — ' : 'خاص — '}${privateStudent.name}` : session.title)
                                : (session.title || group?.name || (isEn ? 'Academic Session' : 'حصة دراسية'))}
                            </h3>

                            {/* Service Badge */}
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                isPrivate
                                  ? 'bg-[#DDD3C7]/15 text-[#0F1206] border border-[#DDD3C7]'
                                  : 'bg-[#DDD3C7]/25 text-[#0F1206] border border-[#DDD3C7]'
                              }`}
                            >
                              {isPrivate ? (isEn ? 'Private' : 'درس خاص') : (group?.name || (isEn ? 'Group' : 'مجموعة'))}
                            </span>

                            {/* Dynamic Semantic Session Status Badge */}
                            {session.status === 'completed' ? (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/65 text-[#0F1206] border border-[#293828]/60 inline-flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-[#293828]" />
                                <span>{isEn ? 'Completed (Recorded)' : 'مكتملة (تم الرصد)'}</span>
                              </span>
                            ) : session.status === 'cancelled' ? (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/15 text-[#0F1206] border border-[#DDD3C7] inline-flex items-center gap-1 shadow-2xs">
                                <AlertCircle className="w-3 h-3 text-[#0F1206]" />
                                <span>{isEn ? 'Cancelled' : 'ملغاة'}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/70 text-[#0F1206] border border-[#0F1206]/50 inline-flex items-center gap-1 shadow-2xs">
                                <Clock className="w-3 h-3 text-[#0F1206]" />
                                <span>{isEn ? 'Scheduled' : 'مجدولة (بانتظار الرصد)'}</span>
                              </span>
                            )}
                          </div>

                          {/* Meta & Duration Details */}
                          <div className="flex items-center gap-2 text-xs text-[#756046] font-medium flex-wrap">
                            {group?.subject && (
                              <span className="text-[#0F1206] font-bold bg-[#DDD3C7]/15 px-2 py-0.5 rounded-lg border border-[#DDD3C7]">
                                {group.subject}
                              </span>
                            )}

                            {group?.gradeLevel && (
                              <span>{getLocalizedStageName(group.gradeLevel)}</span>
                            )}

                            {isHourly && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-[#293828] bg-[#DDD3C7]/25 px-2 py-0.5 rounded-lg border border-[#DDD3C7]">
                                  {isEn ? 'Duration:' : 'المدة:'} {durationLabel}
                                </span>
                              </>
                            )}

                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-[#293828]" />
                              <span>{isPrivate ? (isEn ? '1 Student' : 'طالب واحد') : (isEn ? `${groupStudents.length} Students` : `${groupStudents.length} طلاب`)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing / Effective Session Value */}
                      <div className="shrink-0 text-left">
                        <span className="text-xs font-black px-3 py-1 rounded-xl inline-block bg-[#DDD3C7]/65 text-[#0F1206] border border-[#293828]/50 shadow-2xs">
                          {session.pricePerStudent || group?.defaultPrice || 100} {t('currency')}
                        </span>
                      </div>
                    </div>

                    {/* Attendance State & Quick Actions Strip */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-[#DDD3C7]">
                      {/* Attendance Summary */}
                      <div className="text-xs">
                        {isAttendanceRecorded ? (
                          <div className="flex items-center gap-2 font-bold">
                            <span className="text-[#0F1206] flex items-center gap-1 bg-[#DDD3C7]/65 px-2.5 py-1 rounded-xl border border-[#293828]/50">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Present:' : 'حاضر:'} {presentCount}</span>
                            </span>
                            {absentCount > 0 && (
                              <span className="text-[#0F1206] bg-[#DDD3C7]/15 px-2.5 py-1 rounded-xl border border-[#DDD3C7]">
                                {isEn ? 'Absent:' : 'غياب:'} {absentCount}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#0F1206] bg-[#DDD3C7]/70 px-2.5 py-1 rounded-xl border border-[#DDD3C7] font-bold inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#0F1206]" />
                            <span>{isEn ? 'Attendance not recorded yet' : 'لم يُسجل الحضور بعد'}</span>
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        {/* Quick Mark All Present button if not recorded yet */}
                        {!isAttendanceRecorded && !isPrivate && groupStudents.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleQuickMarkAllPresent(session)}
                            className="px-3 py-1.5 rounded-xl bg-[#DDD3C7]/65 hover:bg-[#DDD3C7]/35 text-[#0F1206] border border-[#293828]/60 font-black text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                            title={isEn ? 'Mark all present in one click' : 'تسجيل حضور جميع طلاب المجموعة بنقرة واحدة'}
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-[#293828] stroke-[2.5]" />
                            <span>{isEn ? 'All Present' : 'حضر الكل'}</span>
                          </button>
                        )}

                        {/* Record / Edit Attendance Modal */}
                        <button
                          type="button"
                          onClick={() => onOpenAttendanceModal(session)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#293828] to-[#0F1206] hover:from-[#0F1206] hover:to-[#293828] text-[#F8F2EC] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#F8F2EC]" />
                          <span>{isAttendanceRecorded ? (isEn ? 'Edit Attendance' : 'تعديل الحضور') : (isEn ? 'Take Attendance' : 'تسجيل الحضور')}</span>
                        </button>

                        {/* Edit Session */}
                        <button
                          type="button"
                          onClick={() => onEditSession(session)}
                          className="p-1.5 rounded-xl bg-[#DDD3C7]/15 hover:bg-[#DDD3C7]/35 text-[#756046] hover:text-[#0F1206] border border-[#DDD3C7] transition-colors cursor-pointer"
                          title={isEn ? 'Edit session details' : 'تعديل تفاصيل الحصة'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Session */}
                        <button
                          type="button"
                          onClick={() => handleDelete(session)}
                          className="p-1.5 rounded-xl bg-[#DDD3C7]/15 hover:bg-[#DDD3C7]/35 text-[#0F1206] border border-[#DDD3C7] transition-colors cursor-pointer"
                          title={isEn ? 'Delete session' : 'حذف الحصة'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          4. CALENDAR VIEW (MultiYearCalendar)
          ========================================================================= */}
      {activeSubTab === 'calendar' && (
        <MultiYearCalendar
          sessions={sessions}
          groups={groups}
          students={students}
          onOpenAddSession={onOpenAddSession}
          onEditSession={onEditSession}
          onOpenAttendanceModal={onOpenAttendanceModal}
          onSessionDeleted={onSessionDeleted}
          onDataChanged={onDataChanged}
        />
      )}

      {/* =========================================================================
          5. SEARCHABLE SESSIONS LIST VIEW
          ========================================================================= */}
      {activeSubTab === 'list' && (
        <div className="space-y-3.5">
          {/* Search & Filter Bar */}
          <div className="classy-card p-4 space-y-3 bg-[#F8F2EC]">
            {/* Search Input */}
            <div className="relative">
              <Search className={`w-4.5 h-4.5 text-[#756046] absolute top-3.5 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? 'Search by session name, group, student, or notes...' : 'ابحث باسم الحصة، المجموعة، الطالب الخاص، أو الملاحظات...'}
                className={`w-full bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-2xl py-3 text-xs sm:text-sm text-[#0F1206] font-medium focus:outline-none focus:border-[#293828] focus:bg-[#F8F2EC] placeholder:text-[#756046]/60 transition-all shadow-inner ${
                  isRTL ? 'pr-11 pl-9' : 'pl-11 pr-9'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute top-3 text-[#756046] hover:text-[#0F1206] p-1 rounded-full hover:bg-[#DDD3C7]/35 transition-colors ${
                    isRTL ? 'left-3' : 'right-3'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Time Range Tabs */}
            <div className="classy-card p-1 flex items-center gap-1 bg-[#DDD3C7]/15 border-[#DDD3C7]">
              <button
                type="button"
                onClick={() => setTimeRangeFilter('all')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  timeRangeFilter === 'all'
                    ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                    : 'text-[#756046] hover:text-[#0F1206]'
                }`}
              >
                {isEn ? `All (${sessions.length})` : `كل الحصص (${sessions.length})`}
              </button>
              <button
                type="button"
                onClick={() => setTimeRangeFilter('today')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  timeRangeFilter === 'today'
                    ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                    : 'text-[#756046] hover:text-[#0F1206]'
                }`}
              >
                {t('today')} ({todaySessions.length})
              </button>
              <button
                type="button"
                onClick={() => setTimeRangeFilter('month')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  timeRangeFilter === 'month'
                    ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                    : 'text-[#756046] hover:text-[#0F1206]'
                }`}
              >
                {isEn ? 'This Month' : 'هذا الشهر'}
              </button>
            </div>

            {/* Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
              <div>
                <label className="block text-[11px] text-[#756046] font-bold mb-1">{isEn ? 'Group / Service' : 'المجموعة / الخدمة'}</label>
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-xl px-3 py-2 text-xs text-[#0F1206] font-bold focus:outline-none focus:border-[#293828] cursor-pointer"
                >
                  <option value="all">{isEn ? 'All Groups & Services' : 'كل المجموعات والخدمات'}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#756046] font-bold mb-1">{isEn ? 'Session Status' : 'حالة الحصة'}</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-xl px-3 py-2 text-xs text-[#0F1206] font-bold focus:outline-none focus:border-[#293828] cursor-pointer"
                >
                  <option value="all">{isEn ? 'All Statuses' : 'كل الحالات'}</option>
                  <option value="completed">{isEn ? 'Completed' : 'مكتملة'}</option>
                  <option value="scheduled">{isEn ? 'Scheduled' : 'مجدولة'}</option>
                  <option value="cancelled">{isEn ? 'Cancelled' : 'ملغاة'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#756046] font-bold mb-1">{isEn ? 'Filter by Date' : 'تصفية بتاريخ محدد'}</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-xl px-3 py-1.5 text-xs text-[#0F1206] font-bold focus:outline-none focus:border-[#293828]"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      className="px-2.5 py-1.5 text-xs bg-[#DDD3C7]/25 hover:bg-[#DDD3C7]/50 text-[#293828] rounded-xl font-bold cursor-pointer"
                    >
                      {t('clear')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {hasActiveListFilters && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleResetListFilters}
                  className="px-3 py-1.5 rounded-xl bg-[#DDD3C7]/25 text-[#293828] font-bold text-xs hover:bg-[#293828] hover:text-[#F8F2EC] transition-all cursor-pointer"
                >
                  {t('resetFilters')}
                </button>
              </div>
            )}
          </div>

          {/* Sessions Stacked Cards */}
          {sessions.length === 0 ? (
            <div className="classy-card p-8 text-center space-y-3 flex flex-col items-center bg-[#F8F2EC]">
              <div className="w-16 h-16 rounded-2xl bg-[#DDD3C7]/25 flex items-center justify-center p-2 shadow-inner">
                <ClassyOwlMascot size="sm" glow={false} pose="smart" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-[#0F1206]">{isEn ? 'No sessions recorded yet' : 'لا توجد حصص مسجلة بعد'}</h3>
                <p className="text-xs text-[#756046] max-w-sm mx-auto">
                  {isEn ? 'Schedule your first session to track attendance and follow up.' : 'قم بجدولة حصتك الأولى لتسجيل الحضور ومتابعة الطلاب'}
                </p>
              </div>
              <button
                onClick={() => onOpenAddSession()}
                className="mt-1 px-4 py-2 rounded-2xl bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-[#0F1206]/30"
              >
                <Plus className="w-4 h-4" />
                <span>{t('scheduleSessionBtn')}</span>
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="classy-card p-8 text-center text-[#756046] space-y-2 bg-[#F8F2EC]">
              <AlertCircle className="w-7 h-7 mx-auto text-[#0F1206]" />
              <p className="font-bold text-[#0F1206] text-xs">{isEn ? 'No sessions match filters' : 'لا توجد حصص تطابق خيارات التصفية'}</p>
              {hasActiveListFilters && (
                <button
                  onClick={handleResetListFilters}
                  className="px-3 py-1.5 rounded-xl bg-[#DDD3C7]/25 text-[#293828] font-bold text-xs hover:bg-[#293828] hover:text-[#F8F2EC] transition-all cursor-pointer mt-1"
                >
                  {t('resetFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSessions.map((session) => {
                const group = groups.find((g) => g.id === session.groupId);
                const isPrivate = group?.type === 'private' || !!session.studentId;

                const privateStudent = isPrivate
                  ? (session.studentId ? db.getStudentById(session.studentId) : undefined)
                  : undefined;

                const groupStudents = isPrivate
                  ? (privateStudent ? [privateStudent] : db.getGroupStudents(session.groupId))
                  : db.getGroupStudents(session.groupId);

                const attendance = allAttendance.filter((a) => a.sessionId === session.id);
                const isAttendanceRecorded = attendance.length > 0;
                const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
                const chargedAbsentCount = attendance.filter(
                  (a) => a.isCharged || a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
                ).length;
                const freeAbsentCount = attendance.filter(
                  (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
                ).length;

                const isHourly = group?.billingMode === 'hourly' || group?.billingType === 'hourly';
                const durationLabel = formatDurationLabel(session.hours, session.startTime, session.endTime, isEn);

                const themeColor = isPrivate ? '#0F1206' : (group?.accentColor || '#293828');
                const localizedDay = getLocalizedWeekdayName(session.dayName);

                return (
                  <div
                    key={session.id}
                    className={`classy-card classy-card-hover p-4 transition-all shadow-xs space-y-2.5 bg-[#F8F2EC] ${
                      session.status === 'cancelled'
                        ? 'border-[#DDD3C7] bg-[#DDD3C7]/15'
                        : 'hover:border-[#293828]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: themeColor }}
                          />
                          <h3 className="font-bold text-sm text-[#0F1206] truncate">
                            {isPrivate ? (privateStudent ? `${isEn ? 'Private — ' : 'خاص — '}${privateStudent.name}` : session.title) : session.title}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isPrivate
                                ? 'bg-[#DDD3C7]/15 text-[#0F1206] border border-[#DDD3C7]'
                                : 'bg-[#DDD3C7]/25 text-[#0F1206]'
                            }`}
                          >
                            {isPrivate ? (isEn ? 'Private' : 'درس خاص') : (group?.name || (isEn ? 'Group' : 'مجموعة'))}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#756046] flex-wrap font-medium">
                          <span className="flex items-center gap-1 font-bold text-[#0F1206]">
                            <Calendar className="w-3.5 h-3.5 text-[#756046]" />
                            <span>{localizedDay} {session.date}</span>
                          </span>

                          {session.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#756046]" />
                              <span>{formatTimeDisplay(session.startTime, isRTL)}</span>
                            </span>
                          )}

                          {isHourly && (
                            <span className="font-bold text-[#293828] bg-[#DDD3C7]/25 px-1.5 py-0.2 rounded text-[11px]">
                              {durationLabel}
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-[#756046]" />
                            <span>{isPrivate ? (isEn ? '1 Student' : 'طالب واحد') : (isEn ? `${groupStudents.length} Students` : `${groupStudents.length} طلاب`)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Dynamic Semantic Session Status Badge */}
                      {session.status === 'completed' ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/65 text-[#0F1206] border border-[#293828]/60 inline-flex items-center gap-1 shadow-2xs shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-[#293828]" />
                          <span>{isEn ? 'Completed' : 'مكتملة'}</span>
                        </span>
                      ) : session.status === 'cancelled' ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/15 text-[#0F1206] border border-[#DDD3C7] inline-flex items-center gap-1 shadow-2xs shrink-0">
                          <AlertCircle className="w-3 h-3 text-[#0F1206]" />
                          <span>{isEn ? 'Cancelled' : 'ملغاة'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/70 text-[#0F1206] border border-[#0F1206]/50 inline-flex items-center gap-1 shadow-2xs shrink-0">
                          <Clock className="w-3 h-3 text-[#0F1206]" />
                          <span>{isEn ? 'Scheduled' : 'مجدولة'}</span>
                        </span>
                      )}
                    </div>

                    {session.notes && (
                      <p className="text-xs text-[#756046] bg-[#DDD3C7]/15 p-2.5 rounded-xl border border-[#DDD3C7] font-medium">
                        {session.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#DDD3C7]">
                      <div className="text-xs text-[#756046]">
                        {isAttendanceRecorded ? (
                          <div className="flex items-center gap-2 flex-wrap font-bold">
                            <span className="text-[#0F1206]">{isEn ? 'Present:' : 'حاضر:'} {presentCount}</span>
                            {chargedAbsentCount > 0 && (
                              <span className="text-[#0F1206]">· {isEn ? 'Absent:' : 'غياب:'} {chargedAbsentCount}</span>
                            )}
                            {freeAbsentCount > 0 && (
                              <span className="text-[#756046]">· {isEn ? 'Excused:' : 'معذور:'} {freeAbsentCount}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#756046]/80">{isEn ? 'Attendance not taken' : 'لم يُرصد الحضور بعد'}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenAttendanceModal(session)}
                          className="px-3 py-1.5 rounded-xl bg-[#293828] hover:bg-[#0F1206] text-[#F8F2EC] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#F8F2EC]" />
                          <span>{isAttendanceRecorded ? (isEn ? 'Edit Attendance' : 'تعديل الحضور') : (isEn ? 'Take Attendance' : 'رصد الحضور')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditSession(session)}
                          className="p-1.5 rounded-xl bg-[#DDD3C7]/15 border border-[#DDD3C7] text-[#756046] hover:text-[#0F1206] hover:bg-[#DDD3C7]/35 transition-colors cursor-pointer"
                          title={isEn ? 'Edit session' : 'تعديل الحصة'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(session)}
                          className="p-1.5 rounded-xl bg-[#DDD3C7]/15 border border-[#DDD3C7] text-[#0F1206] hover:bg-[#DDD3C7]/35 transition-colors cursor-pointer"
                          title={isEn ? 'Delete session' : 'حذف الحصة'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
