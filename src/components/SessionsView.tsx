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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#14152C] pb-28 bg-[#F4F3FA]" dir="rtl">
      
      {/* Primary Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 classy-card p-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EDE8FF] text-[#7B61FF] flex items-center justify-center font-bold">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-[#14152C] tracking-tight">
              جدول وتقويم الحصص
            </h1>
          </div>
          <p className="text-xs text-[#727494] font-medium mt-0.5">
            تصفح ومتابعة الحصص عبر السنوات والشهور ورصد الحضور بدقة
          </p>
        </div>

        {/* Tab Switcher: Multi-Year Calendar vs List View */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-[#F4F3FA] p-1 rounded-2xl border border-[#E8E4F5]">
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'calendar'
                  ? 'bg-white text-[#7B61FF] shadow-sm'
                  : 'text-[#727494] hover:text-[#14152C]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>التقويم السنوي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'list'
                  ? 'bg-white text-[#7B61FF] shadow-sm'
                  : 'text-[#727494] hover:text-[#14152C]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>سجل الحصص ({sessions.length})</span>
            </button>
          </div>

          <button
            onClick={() => onOpenAddSession()}
            className="px-3.5 py-2 rounded-2xl btn-coral text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 transition-all active:scale-95 shrink-0 cursor-pointer"
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
          <div className="classy-card p-3.5 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#727494] font-bold mb-1">المجموعة</label>
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-xl px-2.5 py-2 text-xs text-[#14152C] font-bold focus:outline-none focus:border-[#7B61FF] cursor-pointer"
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
                <label className="block text-[10px] text-[#727494] font-bold mb-1">حالة الحصة</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-xl px-2.5 py-2 text-xs text-[#14152C] font-bold focus:outline-none focus:border-[#7B61FF] cursor-pointer"
                >
                  <option value="all">كل الحالات</option>
                  <option value="scheduled">مجدولة (قادمة)</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[#727494] font-bold mb-1">تصفية بالتاريخ</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-xl px-2.5 py-1.5 text-xs text-[#14152C] font-bold focus:outline-none focus:border-[#7B61FF]"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate('')}
                      className="px-2.5 py-1.5 text-[11px] bg-[#EDE8FF] hover:bg-[#DDD6FE] text-[#7B61FF] rounded-xl font-bold cursor-pointer"
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
              <div className="w-20 h-20 rounded-3xl bg-[#EDE8FF] flex items-center justify-center p-2 shadow-inner">
                <ClassyOwlMascot size="sm" glow={false} pose="smart" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-[#14152C]">لا توجد حصص مسجلة بعد</h3>
                <p className="text-xs text-[#727494] max-w-sm mx-auto font-medium">
                  قم بجدولة حصتك الأولى لتسجيل الحضور ومتابعة الطلاب
                </p>
              </div>
              <button
                onClick={() => onOpenAddSession()}
                className="mt-2 px-4 py-2 rounded-2xl btn-coral text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>جدولة حصة جديدة</span>
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="classy-card p-8 text-center text-[#727494] space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-[#FFAA2C]" />
              <p className="font-bold text-[#14152C] text-xs">لا توجد حصص تطابق خيارات التصفية</p>
            </div>
          ) : (
            <div className="space-y-2.5">
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
                    className={`classy-card classy-card-hover p-4 transition-all space-y-3 ${
                      session.status === 'cancelled'
                        ? 'border-[#FFD6D6] bg-[#FFEBEB]/40'
                        : ''
                    }`}
                  >
                    {/* Top Row: Title, Date, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: group?.accentColor || '#7B61FF' }}
                          />
                          <h3 className="font-bold text-xs sm:text-sm text-[#14152C] truncate">{session.title}</h3>
                          <span className="text-[10px] font-bold bg-[#EDE8FF] text-[#7B61FF] px-2.5 py-0.5 rounded-full">
                            {group?.name || 'مجموعة'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[#727494] flex-wrap font-medium">
                          <span className="flex items-center gap-1 font-black text-[#14152C]">
                            <Calendar className="w-3.5 h-3.5 text-[#727494]" />
                            <span>{session.dayName} {session.date}</span>
                          </span>

                          {session.startTime && (
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5 text-[#727494]" />
                              <span>الساعة {session.startTime}</span>
                            </span>
                          )}

                          <span className="flex items-center gap-1 font-bold text-[#7B61FF]">
                            <Users className="w-3.5 h-3.5" />
                            <span>{groupStudents.length} طلاب</span>
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                          session.status === 'completed'
                            ? 'bg-[#E0F7EF] text-emerald-700 border border-emerald-200'
                            : session.status === 'cancelled'
                            ? 'bg-[#FFEBEB] text-[#FF5E62] border border-[#FFD6D6]'
                            : 'bg-[#FFF5E5] text-[#FFAA2C] border border-[#FFE8C2]'
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
                      <div className="p-2.5 rounded-2xl bg-[#FFEBEB] border border-[#FFD6D6] text-[#FF5E62] text-[11px] font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>حصة ملغاة: لا تُحسب حضوراً ولا تستهلك رصيداً</span>
                      </div>
                    )}

                    {/* Session Notes if any */}
                    {session.notes && (
                      <p className="text-[11px] text-[#727494] bg-[#F4F3FA] p-2.5 rounded-2xl border border-[#E8E4F5] leading-relaxed">
                        <strong className="text-[#14152C]">ملاحظات:</strong> {session.notes}
                      </p>
                    )}

                    {/* Attendance Summary & Action Strip */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-[#E8E4F5]">
                      <div className="text-[11px] text-[#727494]">
                        {attendance.length > 0 ? (
                          <div className="flex items-center gap-2 flex-wrap font-bold">
                            <span className="text-emerald-700">حاضر: {presentCount}</span>
                            {chargedAbsentCount > 0 && (
                              <span className="text-[#FF5E62]">• محسوب: {chargedAbsentCount}</span>
                            )}
                            {freeAbsentCount > 0 && (
                              <span className="text-[#727494] font-normal">• معذور: {freeAbsentCount}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#727494] font-medium">لم يُرصد الحضور</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenAttendanceModal(session)}
                          className="min-h-[32px] px-3.5 py-1 rounded-xl btn-coral text-white font-bold text-xs flex items-center gap-1 shadow-sm shadow-[#FF5E62]/30 transition-all active:scale-95 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{attendance.length > 0 ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                        </button>

                        <button
                          onClick={() => onEditSession(session)}
                          className="p-1.5 rounded-xl bg-[#F4F3FA] border border-[#E8E4F5] text-[#727494] hover:text-[#14152C] hover:bg-[#ECEAF6] transition-colors cursor-pointer"
                          title="تعديل الحصة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(session)}
                          className="p-1.5 rounded-xl bg-[#FFEBEB] border border-[#FFD6D6] text-[#FF5E62] hover:bg-[#FFD6D6] transition-colors cursor-pointer"
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
