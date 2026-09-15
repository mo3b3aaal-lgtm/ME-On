import React, { useState } from 'react';
import {
  CalendarCheck2,
  Calendar,
  Clock,
  Plus,
  Users,
  CheckCircle2,
  Filter,
  DollarSign,
  AlertCircle,
  Edit2,
  Trash2,
  CalendarDays,
  List,
} from 'lucide-react';
import { Session, Group, Student } from '../types';
import { db } from '../utils/storage';
import { MultiYearCalendar } from './MultiYearCalendar';

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
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const handleDelete = (session: Session) => {
    const sessionAtt = db.getAttendance().filter((a) => a.sessionId === session.id);
    const hasRecordedAttendance = sessionAtt.length > 0;
    const warningMsg = hasRecordedAttendance
      ? `تحذير هام: الحصة "${session.title}" مسجل لها كشف حضور لعدد (${sessionAtt.length}) طالب.\n\nحذف الحصة سيؤدي إلى مسح سجلات الحضور وإلغاء أي مستحقات أو خصومات مالية مترتبة عليها.\n\nهل أنت متأكد من الحذف النهائي؟`
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
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-slate-900 pb-28" dir="rtl">
      
      {/* Primary Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              جدول وتقويم الحصص
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            تصفح ومتابعة الحصص عبر السنوات والشهور ورصد الحضور بدقة
          </p>
        </div>

        {/* Tab Switcher: Multi-Year Calendar vs List View */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-2xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'calendar'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
              <span>التقويم السنوي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-amber-600" />
              <span>سجل وقائمة الحصص ({sessions.length})</span>
            </button>
          </div>

          <button
            onClick={() => onOpenAddSession()}
            className="px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
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
          <div className="p-3 bg-white border border-slate-200/90 rounded-2xl space-y-2 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-1">المجموعة</label>
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none"
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
                <label className="block text-[10px] text-slate-500 font-medium mb-1">حالة الحصة</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none"
                >
                  <option value="all">كل الحالات</option>
                  <option value="scheduled">مجدولة (قادمة)</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-medium mb-1">تصفية بالتاريخ</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      className="px-2 py-1.5 text-[11px] bg-slate-100 text-slate-600 rounded-xl font-medium"
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
            <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center space-y-2 shadow-xs">
              <CalendarCheck2 className="w-8 h-8 mx-auto text-slate-400 opacity-60 mb-1" />
              <h3 className="font-bold text-sm text-slate-900">لا توجد حصص مسجلة بعد</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                قم بجدولة حصتك الأولى لتسجيل الحضور ومتابعة الطلاب
              </p>
              <button
                onClick={() => onOpenAddSession()}
                className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>جدولة حصة جديدة</span>
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center text-slate-400 space-y-1">
              <AlertCircle className="w-7 h-7 mx-auto opacity-60" />
              <p className="font-bold text-slate-800 text-xs">لا توجد حصص تطابق خيارات التصفية</p>
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
                    className={`p-3.5 bg-white border rounded-2xl shadow-xs transition-all space-y-2.5 ${
                      session.status === 'cancelled'
                        ? 'border-rose-200 bg-rose-50/30'
                        : 'border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    {/* Top Row: Title, Date, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: group?.accentColor || '#3B82F6' }}
                          />
                          <h3 className="font-bold text-xs text-slate-900 truncate">{session.title}</h3>
                          <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                            {group?.name || 'مجموعة'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-slate-800">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{session.dayName} {session.date}</span>
                          </span>

                          {session.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>الساعة {session.startTime}</span>
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-blue-600" />
                            <span>{groupStudents.length} طلاب</span>
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md shrink-0 ${
                          session.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : session.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {session.status === 'completed'
                          ? 'مكتملة'
                          : session.status === 'cancelled'
                          ? 'ملغاة'
                          : 'مجدولة'}
                      </span>
                    </div>

                    {/* Cancelled Notice if applicable */}
                    {session.status === 'cancelled' && (
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>حصة ملغاة: لا تُحسب حضوراً ولا تستهلك رصيداً</span>
                      </div>
                    )}

                    {/* Session Notes if any */}
                    {session.notes && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200 leading-relaxed">
                        <strong className="text-slate-800">ملاحظات:</strong> {session.notes}
                      </p>
                    )}

                    {/* Attendance Summary & Action Strip */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500">
                        {attendance.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap font-medium">
                            <span className="text-emerald-700 font-bold">حاضر: {presentCount}</span>
                            {chargedAbsentCount > 0 && (
                              <span className="text-rose-600">• محسوب: {chargedAbsentCount}</span>
                            )}
                            {freeAbsentCount > 0 && (
                              <span className="text-slate-500">• معذور: {freeAbsentCount}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">لم يُرصد الحضور</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenAttendanceModal(session)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{attendance.length > 0 ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                        </button>

                        <button
                          onClick={() => onEditSession(session)}
                          className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                          title="تعديل الحصة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(session)}
                          className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
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
