import React, { useState } from 'react';
import {
  CalendarCheck2,
  Calendar,
  Clock,
  Plus,
  Users,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  CalendarDays,
  List,
  Search,
  X,
} from 'lucide-react';
import { Session, Group, Student } from '../types';
import { db } from '../utils/storage';
import { MultiYearCalendar } from './MultiYearCalendar';
import { ClassyOwlMascot } from './ClassyOwlMascot';

interface SessionsViewProps {
  sessions: Session[];
  groups: Group[];
  students?: Student[];
  onOpenAddSession: (defaultGroupId?: string, defaultDate?: string) => void;
  onEditSession: (session: Session) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onSessionDeleted: () => void;
  onDataChanged?: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  groups,
  students = [],
  onOpenAddSession,
  onEditSession,
  onOpenAttendanceModal,
  onSessionDeleted,
  onDataChanged,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'list'>('calendar');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const handleDelete = (session: Session) => {
    const sessionAtt = db.getAttendance().filter((a) => a.sessionId === session.id);
    const hasRecordedAttendance = sessionAtt.length > 0;
    const warningMsg = hasRecordedAttendance
      ? `تحذير: الحصة "${session.title}" مسجل لها كشف حضور (${sessionAtt.length}) طالب.\n\nحذف الحصة سيؤدي إلى مسح كشف الحضور وتحديث الأرصدة.\n\nهل أنت متأكد من الحذف؟`
      : `هل أنت متأكد من حذف حصة "${session.title}" نهائياً؟`;

    if (confirm(warningMsg)) {
      db.deleteSession(session.id);
      onSessionDeleted();
      if (onDataChanged) onDataChanged();
    }
  };

  const filteredSessions = sessions.filter((session) => {
    if (selectedGroupFilter !== 'all' && session.groupId !== selectedGroupFilter) return false;
    if (statusFilter !== 'all' && session.status !== statusFilter) return false;
    if (selectedDate && session.date !== selectedDate) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const group = groups.find((g) => g.id === session.groupId);
      const titleMatches = session.title?.toLowerCase().includes(q);
      const groupMatches = group?.name?.toLowerCase().includes(q);
      const notesMatches = session.notes?.toLowerCase().includes(q);
      if (!titleMatches && !groupMatches && !notesMatches) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-4 space-y-4 max-w-5xl mx-auto text-[#191A2E] pb-32 bg-[#F6F7FC]" dir="rtl">
      
      {/* Primary Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 classy-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-black shadow-xs">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#17163D] tracking-tight">
              جدول وتقويم الحصص
            </h1>
            <p className="text-xs text-[#74778F] font-medium">
              تصفح الأجندة ورصد الحضور وجدولة الحصص بسهولة
            </p>
          </div>
        </div>

        {/* Tab Switcher: Calendar vs List View */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="classy-segment p-1">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`classy-segment-btn flex items-center gap-1.5 ${
                activeSubTab === 'calendar' ? 'classy-segment-btn-active' : 'classy-segment-btn-inactive'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>التقويم والأجندة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              className={`classy-segment-btn flex items-center gap-1.5 ${
                activeSubTab === 'list' ? 'classy-segment-btn-active' : 'classy-segment-btn-inactive'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>سجل الحصص ({sessions.length})</span>
            </button>
          </div>

          <button
            onClick={() => onOpenAddSession()}
            className="px-3.5 py-2 rounded-2xl btn-coral text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF647C]/30 transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>جدولة حصة</span>
          </button>
        </div>
      </div>

      {/* VIEW CONTENT */}
      {activeSubTab === 'calendar' ? (
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
      ) : (
        <div className="space-y-3.5">
          {/* Filter Bar */}
          <div className="classy-card p-4 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#74778F] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الحصة أو المجموعة..."
                className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-2xl pr-10 pl-8 py-2.5 text-xs text-[#191A2E] font-semibold focus:outline-none focus:border-[#7657F6] placeholder:text-[#74778F]/60"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#74778F] hover:text-[#191A2E]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#74778F] font-bold mb-1">المجموعة</label>
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl px-2.5 py-1.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] cursor-pointer"
                >
                  <option value="all">كل المجموعات</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[#74778F] font-bold mb-1">حالة الحصة</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl px-2.5 py-1.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] cursor-pointer"
                >
                  <option value="all">كل الحالات</option>
                  <option value="scheduled">مجدولة</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[#74778F] font-bold mb-1">تصفية بالتاريخ</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl px-2.5 py-1.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6]"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      className="px-2.5 py-1.5 text-[11px] bg-[#E8E7FF] hover:bg-[#D3D0FB] text-[#7657F6] rounded-xl font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sessions List */}
          {sessions.length === 0 ? (
            <div className="classy-card p-8 text-center space-y-3 flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#E8E7FF] flex items-center justify-center p-2 shadow-inner">
                <ClassyOwlMascot size="sm" glow={false} pose="smart" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-[#17163D]">لا توجد حصص مسجلة بعد</h3>
                <p className="text-xs text-[#74778F] max-w-sm mx-auto">
                  قم بجدولة حصتك الأولى لتسجيل الحضور ومتابعة الطلاب
                </p>
              </div>
              <button
                onClick={() => onOpenAddSession()}
                className="mt-1 px-4 py-2 rounded-2xl btn-coral text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-[#FF647C]/30"
              >
                <Plus className="w-4 h-4" />
                <span>جدولة حصة جديدة</span>
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="classy-card p-8 text-center text-[#74778F] space-y-2">
              <AlertCircle className="w-7 h-7 mx-auto text-[#FF647C]" />
              <p className="font-bold text-[#17163D] text-xs">لا توجد حصص تطابق خيارات التصفية</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSessions.map((session) => {
                const group = groups.find((g) => g.id === session.groupId);
                const isPrivateSession = group?.type === 'private' || !!session.studentId;
                const groupStudents = isPrivateSession
                  ? (session.studentId ? [db.getStudentById(session.studentId)].filter(Boolean) : db.getGroupStudents(session.groupId))
                  : db.getGroupStudents(session.groupId);
                const privateStudent = isPrivateSession
                  ? (session.studentId ? db.getStudentById(session.studentId) : groupStudents[0])
                  : undefined;
                const attendance = db.getSessionAttendance(session.id);
                const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
                const chargedAbsentCount = attendance.filter(
                  (a) => a.isCharged || a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
                ).length;
                const freeAbsentCount = attendance.filter(
                  (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
                ).length;
                const privateAttendanceRecord = isPrivateSession && privateStudent
                  ? attendance.find((a) => a.studentId === privateStudent.id)
                  : undefined;

                return (
                  <div
                    key={session.id}
                    className={`classy-card p-4 transition-all shadow-xs space-y-2.5 ${
                      session.status === 'cancelled'
                        ? 'border-[#FECDD3] bg-[#FFF1F3]/40'
                        : 'hover:border-[#7657F6]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: isPrivateSession ? '#FF647C' : (group?.accentColor || '#7657F6') }}
                          />
                          <h3 className="font-bold text-sm text-[#191A2E] truncate">
                            {isPrivateSession ? (privateStudent ? privateStudent.name : session.title) : session.title}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isPrivateSession
                              ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                              : 'bg-[#E8E7FF] text-[#403B9C]'
                          }`}>
                            {isPrivateSession ? 'درس خاص' : (group?.name || 'مجموعة')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#74778F] flex-wrap font-medium">
                          <span className="flex items-center gap-1 font-bold text-[#191A2E]">
                            <Calendar className="w-3.5 h-3.5 text-[#74778F]" />
                            <span>{session.dayName} {session.date}</span>
                          </span>

                          {session.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#74778F]" />
                              <span>{session.startTime}</span>
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-[#74778F]" />
                            <span>{isPrivateSession ? 'درس خاص لطالب واحد' : `${groupStudents.length} طلاب`}</span>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                          session.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : session.status === 'cancelled'
                            ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                            : 'bg-[#E8E7FF] text-[#403B9C]'
                        }`}
                      >
                        {session.status === 'completed'
                          ? 'مكتملة'
                          : session.status === 'cancelled'
                          ? 'ملغاة'
                          : 'مجدولة'}
                      </span>
                    </div>

                    {session.notes && (
                      <p className="text-xs text-[#74778F] bg-[#F6F7FC] p-2.5 rounded-xl border border-[#E8E7FF] font-medium">
                        {session.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#E8E7FF]">
                      <div className="text-xs text-[#74778F]">
                        {attendance.length > 0 ? (
                          isPrivateSession ? (
                            <div className="flex items-center gap-2 font-bold">
                              {privateAttendanceRecord?.status === 'present' || privateAttendanceRecord?.status === 'late' ? (
                                <span className="text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>حضر</span>
                                </span>
                              ) : privateAttendanceRecord?.status === 'absent_charged' || (privateAttendanceRecord?.status === 'absent' && privateAttendanceRecord?.isCharged !== false) ? (
                                <span className="text-[#FF647C] flex items-center gap-1">
                                  <span>لم يحضر (محسوبة)</span>
                                </span>
                              ) : (
                                <span className="text-[#7657F6] flex items-center gap-1">
                                  <span>اعتذر (غير محسوبة)</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap font-bold">
                              <span className="text-emerald-700">حاضر: {presentCount}</span>
                              {chargedAbsentCount > 0 && (
                                <span className="text-[#FF647C]">· غياب: {chargedAbsentCount}</span>
                              )}
                              {freeAbsentCount > 0 && (
                                <span className="text-[#74778F]">· معذور: {freeAbsentCount}</span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[#74778F]/80">لم يُرصد الحضور بعد</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenAttendanceModal(session)}
                          className="px-3 py-1.5 rounded-xl btn-primary text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{attendance.length > 0 ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                        </button>

                        <button
                          onClick={() => onEditSession(session)}
                          className="p-1.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-[#74778F] hover:text-[#191A2E] hover:bg-[#E8E7FF] transition-colors cursor-pointer"
                          title="تعديل الحصة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(session)}
                          className="p-1.5 rounded-xl bg-[#FFF1F3] border border-[#FECDD3] text-[#FF647C] hover:bg-[#FFE4E6] transition-colors cursor-pointer"
                          title="حذف الحصة"
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
