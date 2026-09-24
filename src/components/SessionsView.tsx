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
    <div className="flex-1 overflow-y-auto android-scrollbar p-3.5 sm:p-5 space-y-4 max-w-5xl mx-auto text-[#0F172A] pb-24 bg-[#F8FAFC]" dir="rtl">
      
      {/* Primary Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[#0F172A]">
              جدول وتقويم الحصص
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              تصفح الأجندة ورصد الحضور وجدولة الحصص بسهولة
            </p>
          </div>
        </div>

        {/* Tab Switcher: Calendar vs List View */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'calendar'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>التقويم والأجندة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'list'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>سجل الحصص ({sessions.length})</span>
            </button>
          </div>

          <button
            onClick={() => onOpenAddSession()}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer"
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
          <div className="bg-white rounded-2xl p-4 space-y-3 border border-slate-200/80 shadow-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الحصة أو المجموعة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-indigo-500 placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">المجموعة</label>
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                <label className="block text-[10px] text-slate-500 font-bold mb-1">حالة الحصة</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">كل الحالات</option>
                  <option value="scheduled">مجدولة</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">تصفية بالتاريخ</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-indigo-500"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      className="px-2.5 py-1.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
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
            <div className="bg-white rounded-2xl p-8 text-center space-y-3 flex flex-col items-center border border-slate-200/80">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center p-2">
                <ClassyOwlMascot size="sm" glow={false} pose="smart" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-[#0F172A]">لا توجد حصص مسجلة بعد</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  قم بجدولة حصتك الأولى لتسجيل الحضور ومتابعة الطلاب
                </p>
              </div>
              <button
                onClick={() => onOpenAddSession()}
                className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>جدولة حصة جديدة</span>
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-500 space-y-2 border border-slate-200/80">
              <AlertCircle className="w-7 h-7 mx-auto text-amber-500" />
              <p className="font-bold text-[#0F172A] text-xs">لا توجد حصص تطابق خيارات التصفية</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSessions.map((session) => {
                const group = groups.find((g) => g.id === session.groupId);
                const groupStudents = db.getGroupStudents(session.groupId);
                const attendance = db.getSessionAttendance(session.id);
                const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
                const chargedAbsentCount = attendance.filter(
                  (a) => a.isCharged || a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
                ).length;
                const freeAbsentCount = attendance.filter(
                  (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
                ).length;

                return (
                  <div
                    key={session.id}
                    className={`bg-white rounded-2xl p-3.5 border transition-all shadow-xs space-y-2.5 ${
                      session.status === 'cancelled'
                        ? 'border-rose-200 bg-rose-50/30'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: group?.accentColor || '#4F46E5' }}
                          />
                          <h3 className="font-bold text-sm text-[#0F172A] truncate">{session.title}</h3>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                            {group?.name || 'مجموعة'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap font-medium">
                          <span className="flex items-center gap-1 font-bold text-[#0F172A]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{session.dayName} {session.date}</span>
                          </span>

                          {session.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{session.startTime}</span>
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{groupStudents.length} طلاب</span>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          session.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : session.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
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
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 font-medium">
                        {session.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="text-xs text-slate-500">
                        {attendance.length > 0 ? (
                          <div className="flex items-center gap-2 flex-wrap font-medium">
                            <span className="text-emerald-700 font-bold">حاضر: {presentCount}</span>
                            {chargedAbsentCount > 0 && (
                              <span className="text-rose-700">· غياب: {chargedAbsentCount}</span>
                            )}
                            {freeAbsentCount > 0 && (
                              <span className="text-slate-400">· معذور: {freeAbsentCount}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">لم يُرصد الحضور</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenAttendanceModal(session)}
                          className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{attendance.length > 0 ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                        </button>

                        <button
                          onClick={() => onEditSession(session)}
                          className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
                          title="تعديل الحصة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(session)}
                          className="p-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
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
