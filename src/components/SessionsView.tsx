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
} from 'lucide-react';
import { Session, Group } from '../types';
import { db } from '../utils/storage';

interface SessionsViewProps {
  sessions: Session[];
  groups: Group[];
  onOpenAddSession: (defaultGroupId?: string) => void;
  onEditSession: (session: Session) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onSessionDeleted: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  groups,
  onOpenAddSession,
  onEditSession,
  onOpenAttendanceModal,
  onSessionDeleted,
}) => {
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
    }
  };

  const filteredSessions = sessions.filter((session) => {
    if (selectedGroupFilter !== 'all' && session.groupId !== selectedGroupFilter) return false;
    if (statusFilter !== 'all' && session.status !== statusFilter) return false;
    if (selectedDate && session.date !== selectedDate) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-[#272D24] pb-24" dir="rtl">
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#272D24] tracking-tight">
            جدول وسجل الحصص ({sessions.length})
          </h1>
          <p className="text-xs text-[#878E82] font-medium mt-0.5">
            متابعة الحصص المنفذة والقادمة ورصد الحضور بدقة
          </p>
        </div>

        <button
          onClick={() => onOpenAddSession()}
          className="px-3 py-2 rounded-2xl bg-[#607B5E] hover:bg-[#50684E] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>جدولة حصة</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl space-y-2 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          
          <div>
            <label className="block text-[10px] text-[#878E82] font-medium mb-1">المجموعة</label>
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl px-2.5 py-1.5 text-xs text-[#272D24] font-medium focus:outline-none"
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
            <label className="block text-[10px] text-[#878E82] font-medium mb-1">حالة الحصة</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl px-2.5 py-1.5 text-xs text-[#272D24] font-medium focus:outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="scheduled">مجدولة (قادمة)</option>
              <option value="completed">مكتملة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#878E82] font-medium mb-1">تصفية بالتاريخ</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl px-2.5 py-1.5 text-xs text-[#272D24] focus:outline-none"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="px-2 py-1.5 text-[11px] bg-[#F5F2EC] text-[#5F675A] rounded-xl font-medium"
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
        <div className="p-8 bg-white border border-[#EAE6DE] rounded-2xl text-center space-y-2 shadow-xs">
          <CalendarCheck2 className="w-8 h-8 mx-auto text-[#878E82] opacity-40 mb-1" />
          <h3 className="font-bold text-sm text-[#272D24]">لا توجد حصص مسجلة بعد</h3>
          <p className="text-xs text-[#878E82] max-w-sm mx-auto">
            قم بجدولة حصتك الأولى لتسجيل الحضور ومتابعة الطلاب
          </p>
          <button
            onClick={() => onOpenAddSession()}
            className="mt-3 px-4 py-2 rounded-xl bg-[#607B5E] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>جدولة حصة جديدة</span>
          </button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-8 bg-white border border-[#EAE6DE] rounded-2xl text-center text-[#878E82] space-y-1">
          <AlertCircle className="w-7 h-7 mx-auto opacity-40" />
          <p className="font-bold text-[#272D24] text-xs">لا توجد حصص تطابق خيارات التصفية</p>
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
                    ? 'border-[#B86B52]/25 bg-[#B86B52]/5'
                    : 'border-[#EAE6DE] hover:border-[#607B5E]/40'
                }`}
              >
                {/* Top Row: Title, Date, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: group?.accentColor || '#607B5E' }}
                      />
                      <h3 className="font-bold text-xs text-[#272D24] truncate">{session.title}</h3>
                      <span className="text-[10px] font-medium bg-[#F5F2EC] text-[#5F675A] px-2 py-0.5 rounded-md">
                        {group?.name || 'مجموعة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#878E82] flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-[#272D24]">
                        <Calendar className="w-3.5 h-3.5 text-[#586E7E]" />
                        <span>{session.dayName} {session.date}</span>
                      </span>

                      {session.startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#586E7E]" />
                          <span>الساعة {session.startTime}</span>
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#607B5E]" />
                        <span>{groupStudents.length} طلاب</span>
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      session.status === 'completed'
                        ? 'bg-[#607B5E]/12 text-[#4E664C]'
                        : session.status === 'cancelled'
                        ? 'bg-[#B86B52]/12 text-[#9A543E]'
                        : 'bg-[#B88438]/12 text-[#946522]'
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
                  <div className="p-2 rounded-xl bg-[#B86B52]/10 border border-[#B86B52]/20 text-[#9A543E] text-[10px] font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>حصة ملغاة: لا تُحسب حضوراً ولا تستهلك رصيداً</span>
                  </div>
                )}

                {/* Session Homework / Notes if any */}
                {session.notes && (
                  <p className="text-[11px] text-[#5F675A] bg-[#FAF8F5] p-2 rounded-xl border border-[#EAE6DE] leading-relaxed">
                    <strong className="text-[#272D24]">ملاحظات:</strong> {session.notes}
                  </p>
                )}

                {/* Attendance Summary & Action Strip */}
                <div className="flex items-center justify-between pt-2 border-t border-[#EAE6DE]/70">
                  <div className="text-[11px] text-[#878E82]">
                    {attendance.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap font-medium">
                        <span className="text-[#607B5E] font-bold">حاضر: {presentCount}</span>
                        {chargedAbsentCount > 0 && (
                          <span className="text-[#B86B52]">• محسوب: {chargedAbsentCount}</span>
                        )}
                        {freeAbsentCount > 0 && (
                          <span className="text-[#878E82]">• معذور: {freeAbsentCount}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#878E82]">لم يُرصد الحضور</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenAttendanceModal(session)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#607B5E] hover:bg-[#50684E] text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{attendance.length > 0 ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                    </button>

                    <button
                      onClick={() => onEditSession(session)}
                      className="p-1.5 rounded-xl bg-[#F5F2EC] text-[#5F675A] hover:text-[#272D24] hover:bg-[#EAE6DE]"
                      title="تعديل الحصة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(session)}
                      className="p-1.5 rounded-xl bg-[#FAF0ED] text-[#B86B52] hover:bg-[#F5E5E0]"
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
  );
};
